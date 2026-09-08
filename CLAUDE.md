# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Agenda Metal Colaborativa

App web para descubrir y agregar conciertos/festivales de metal de forma colaborativa. Monorepo sin workspaces (cada servicio instala sus propias dependencias):

- `apps/web` — Next.js 14 App Router + TypeScript + TailwindCSS (frontend, corre fuera de Docker)
- `apps/api` — NestJS 10 + Prisma 5 + PostgreSQL 16 (API REST, prefijo global `api/v1`)
- `apps/etl` — Python 3.12 + Celery + Redis (scraping y homologación de bandas/eventos)

## Estado real del scaffold (no asumas que algo existe)

El repo es un scaffold parcial: hay mucho diseño escrito y poca implementación. Antes de "arreglar" algo, verifica si simplemente todavía no está escrito.

- **API**: solo `auth/` y `events/` están implementados. `bands`, `venues`, `moderation`, `users`, `reminders` no existen (ver los comentarios en `apps/api/src/app.module.ts`).
- **ETL**: solo existe el motor de matching. `apps/etl/tasks/` está **vacío**, pero `celery_app.py` agenda `tasks.bandsintown.run`, `tasks.setlist_fm.run`, `tasks.metal_archives.run`, `tasks.metal_storm.run` y `tasks.reminders.dispatch` — beat falla al despachar hasta que se escriban.
- **Web**: solo Home (`app/page.tsx`) y detalle de evento (`app/eventos/[slug]/page.tsx`). No hay `/bandas`, `/venues`, `/moderacion` ni formularios de alta.
- **CI/CD**: **no existe `.github/`**. El diseño de los pipelines (con los YAML de referencia) está en `docs/Diseño de CI CD.md`.
- **Pruebas**: el único test real es `apps/etl/matching/test_band_matcher.py`. En la API y el web hay scripts `test:unit` pero **cero archivos de test y ninguna config de jest**, así que hoy fallan con "no tests found". `next lint` tampoco tiene config de eslint todavía.

## Documentación de diseño (`docs/`)

Los nombres de archivo llevan acentos y espacios — cítalos entre comillas en la shell. Revisa el documento correspondiente antes de tocar el área; ahí ya hay decisiones tomadas:

| Si vas a tocar... | Lee primero |
|---|---|
| Cualquier tabla o relación de la base de datos | `docs/Diseño de Base de Datos V1.md` + `docs/Schema SQL.md` (fuente de verdad, salvo `refresh_tokens`, `auth_tokens`, `push_subscriptions` y `system_settings`, que solo están en `schema.prisma`) |
| Un endpoint nuevo o existente | `docs/Diseño API.md` (convenciones, formato de error, matriz de autorización por rol) |
| Login, JWT, refresh tokens, OAuth | `docs/Diseño API.md` sección 2 |
| Scraping, homologación de bandas, matching | `docs/Diseño del Módulo ETL.md` |
| Recordatorios, notificaciones, los interruptores global/por-usuario | `docs/Diseño del Módulo de Recordatorios.md` |
| Pipelines de CI/CD, Docker | `docs/Diseño de CI CD.md` |
| Requerimientos funcionales (RF-XX), WBS, roadmap, arquitectura | `docs/Documentación de Proyecto.md` |
| Qué está hecho, qué sigue y en qué orden | `docs/Plan de Trabajo y Hitos.md` (estatus verificado contra el código, 2026-09-04) |

**Punteros rotos**: el código y los comentarios citan `diseno-autenticacion.md`, `diseno-frontend.md` y `plan-de-pruebas.md`, además de nombres en kebab-case (`diseno-api.md`, `schema.sql`). **Ninguno de esos archivos existe.** Traduce mentalmente al nombre real de la tabla de arriba; para frontend y plan de pruebas no hay documento — no inventes que lo leíste.

## Comandos

```bash
# Levantar backend + infra (el frontend va aparte, para hot-reload nativo)
docker compose up -d postgres redis api etl-worker etl-beat

# Frontend
cd apps/web && npm install && npm run dev     # http://localhost:3000

# Migraciones (tras cambiar prisma/schema.prisma) — se corren desde el host
cd apps/api && npx prisma migrate dev
psql $DATABASE_URL -f prisma/manual-constraints.sql   # el delta que Prisma no expresa
npx prisma generate                                    # tras cambiar el schema

# Tests (hoy solo el del ETL corre de verdad)
cd apps/etl && pytest -v                               # pytest NO está en requirements.txt
cd apps/etl && pytest matching/test_band_matcher.py::test_tribute_band_never_auto_merges_with_original_even_at_high_score
```

`pytest` debe correrse **desde `apps/etl`**: el test importa `from matching.band_matcher import ...`, no funciona desde la raíz.

### Puertos y conexión a la base de datos

Es la fuente número uno de confusión en este repo:

- Postgres se publica en **5433 en el host** (para no chocar con un Postgres de Homebrew en 5432); dentro de la red de compose sigue siendo `postgres:5432`.
- `apps/api/.env` usa `127.0.0.1:5433` porque los comandos de Prisma se corren desde el host; compose inyecta `postgres:5432` al contenedor y esa variable gana. (`apps/etl/.env` dice `localhost:5432`, que sería incorrecto desde el host — solo funciona porque compose sobrescribe la variable.)
- API en `3001` con prefijo `api/v1` → `http://localhost:3001/api/v1/events`. El frontend lo lee de `NEXT_PUBLIC_API_URL`.
- La API corre en modo watch dentro de Docker (`npm run start:dev`), no desde `dist/`: el volumen `./apps/api:/app` taparía el `dist` de la imagen.

## Arquitectura

### API — dónde vive cada responsabilidad

El flujo de una petición autenticada es: `JwtAuthGuard` (solo verifica el JWT y pone `req.user = { sub, role }`) → `RolesGuard` (lee el decorador `@Roles(...)`) → `OwnershipGuard` (consulta la BD: dueño + `status=pendiente`) → controller → service → Prisma.

- **La autorización no vive en el `JwtAuthGuard`**; ese guard solo autentica. `OwnershipGuard` recibe la entidad (`'band' | 'venue' | 'event'`) por constructor, así que se instancia por ruta, no se aplica con `@UseGuards(OwnershipGuard)` a secas.
- **Los errores de constraint de Postgres se traducen en un solo lugar**: `common/filters/prisma-exception.filter.ts`, registrado globalmente en `main.ts`. Los services **no** llevan `try/catch` alrededor de escrituras que puedan chocar — es deliberado, ver el comentario en `events.service.ts:addToLineup`. Si agregas un constraint nuevo en `manual-constraints.sql`, su mapeo a código de error de la API va en ese filtro.
- **`apps/api/src/events/` es el patrón de referencia** (controller + service + DTOs + guards + `dto/`). Todo módulo nuevo lo replica; no introduzcas un patrón distinto ni carpetas `*.module.ts` por feature mientras `app.module.ts` siga registrando controllers y providers directo.
- **El slug se genera en el service** (`uniqueSlug`), no en la BD, y sufija `-2`, `-3`… consultando solo entre registros activos.

### ETL — el matcher es lo único que existe

`matching/band_matcher.py` es una función pura (`match_band`) sin I/O: recibe los candidatos ya consultados y devuelve un `MatchResult`. El orden de la cascada es parte del contrato, no una optimización: ID externo exacto → MBID → **salvaguarda de tributos** → determinístico (nombre normalizado + país) → fuzzy (`rapidfuzz`, auto ≥92, revisión manual ≥75). La salvaguarda va **antes** del fuzzy a propósito.

### Web

Server Components que llaman a `lib/api-client.ts` con `next: { revalidate: 60 }` (ISR corto). El marco general (masthead + nav persistentes) vive en `app/layout.tsx`; la barra utilitaria y el layout de dos columnas los arma cada página con `PageLayout` / `UtilityBar` / `SidebarCard`.

## Reglas de negocio que no son obvias leyendo el código

- **Bandas tributo**: `bands.is_tribute` + `tribute_of_band_id`. El matcher **nunca** auto-homologa una banda con marcador de tributo (`tributo`/`tribute`/`cover band`/`cover`/`homenaje`) contra la original, sin importar el score; devuelve `band_id=None` y *sugiere* la original para que un Moderador confirme. Los CHECK `chk_tribute_reference` y `chk_tribute_not_self` lo respaldan en la BD.
- **Moderación**: todo contenido creado por un usuario (banda/venue/evento) nace en `status=pendiente` y no es público hasta que un Moderador+ lo apruebe — **incluso si lo crea un Administrador** (RF-19). No lo saltes "por conveniencia".
- **Soft delete**: `bands`, `venues`, `events` nunca se borran físicamente (`deleted_at`). Toda consulta pública filtra `deletedAt: null` **y** `status: 'aprobado'` — no hay middleware de Prisma que lo aplique solo, es responsabilidad de cada query. Los slugs son únicos solo entre registros activos (índice parcial `WHERE deleted_at IS NULL`), así que un slug se puede reutilizar tras un borrado.
- **Listados públicos excluyen tributos por defecto**: `GET /events` filtra `eventBands: { none: { band: { isTribute: true } } }` salvo que llegue `isTribute=true` o `isTribute=all`.
- **Choque de horario**: lo garantiza el constraint `EXCLUDE ... USING GIST` `excl_stage_time_overlap` en `event_bands` (no una validación de aplicación) — ver `apps/api/prisma/manual-constraints.sql`. El filtro de excepciones lo traduce a `409 SCHEDULE_CONFLICT`.
- **Refresh tokens**: opacos (no JWT), se guarda solo el `sha256`. Rotan por *family*; si llega uno ya revocado se asume robo de sesión y se revoca **toda la family**, no solo ese token (`auth.service.ts:refresh`).
- **Interruptores de notificación**: hay uno global (`system_settings.notifications_enabled`, cacheado en Redis 30s) y uno por usuario (`users.notifications_paused_at`). Un recordatorio de un evento que ya pasó nunca se envía tarde tras reactivar — ver `docs/Diseño del Módulo de Recordatorios.md` sección 5.

## Convenciones

- **Idioma**: comentarios, mensajes de error de la API y commits en español. Los mensajes de error de cara al usuario también.
- **Paleta**: fondo carbón `#1E2024`, texto `#EDEDE8`, acento rojo `#C8102E` — ya son tokens en `apps/web/tailwind.config.ts` (`bg`, `fg`, `accent`, `stripe`, `rule`, `muted`, `accent-bright`). No hardcodees hex nuevos.
- **Formato de error de la API**: siempre `{ error: { code, message } }` con `code` en SCREAMING_SNAKE (`SCHEDULE_CONFLICT`, `UNIQUE_VIOLATION`, …), ver `docs/Diseño API.md` sección 1.
- **Migraciones**: `schema.prisma` se deriva de `docs/Schema SQL.md`, y lo que Prisma no sabe expresar (EXCLUDE, índices parciales, CITEXT, GIN/trgm, CHECKs compuestos) va a `manual-constraints.sql` — nunca solo en uno de los dos.
