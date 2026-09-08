# Agenda Metal Colaborativa

Monorepo con tres servicios, cada uno con su propio ciclo de vida (ver `docs/Diseño de CI CD.md`):

```
apps/
  web/    → Next.js 14 + TypeScript + TailwindCSS (frontend público)
  api/    → NestJS + Prisma + PostgreSQL (API REST)
  etl/    → Python + Celery + Redis (scraping y homologación de bandas/eventos)
```

## Cómo levantar todo en local

1. Copia `.env.example` a `.env` en `apps/api/` y `apps/etl/` (variables reales: JWT secret, credenciales OAuth, `app_id` de Bandsintown, API keys de MusicBrainz/Setlist.fm — ninguna incluida en este scaffold).
2. Levanta Postgres, Redis, la API y los workers de ETL:
   ```bash
   docker compose up -d postgres redis api etl-worker etl-beat
   ```
3. Corre las migraciones (primera vez, y cada vez que cambie `prisma/schema.prisma`):
   ```bash
   cd apps/api
   npx prisma migrate dev
   # luego aplicar a mano el delta que Prisma no expresa nativamente:
   psql $DATABASE_URL -f prisma/manual-constraints.sql
   ```
4. El frontend corre aparte, sin Docker, para hot-reload rápido:
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```
5. Abre `http://localhost:3000`.

## Qué ya está implementado en este scaffold

- **Esquema de base de datos completo** (`apps/api/prisma/schema.prisma`) — todas las entidades de `docs/Schema SQL.md` (bandas tributo, soft delete, moderación) más las cuatro tablas de autenticación (`refresh_tokens`, `auth_tokens`, `push_subscriptions`, `system_settings`), que **solo existen aquí**: el documento de esquema todavía no las incluye.
- **Módulo de autenticación completo**: registro, login, rotación de refresh tokens con detección de reutilización (robo de sesión), logout y logout-all. Los endpoints y el mecanismo (JWT 15 min + refresh rotativo de 7 días) están en `docs/Diseño API.md` sección 2; el documento de detalle del flujo de autenticación que ese mismo doc cita (`diseno-autenticacion.md`) nunca se escribió.
- **Guards de autorización**: `JwtAuthGuard`, `RolesGuard` (matriz de roles), `OwnershipGuard` (contenido propio pendiente vs. publicado).
- **Filtro de excepciones** que traduce el constraint `EXCLUDE` de Postgres (choque de horario) a `409 SCHEDULE_CONFLICT`, tal como se definió en `docs/Diseño API.md` sección 1.
- **Módulo de eventos** como referencia del patrón completo (listado con filtros, detalle, alta con moderación, alta de line-up).
- **Motor de homologación de bandas** (`apps/etl/matching/band_matcher.py`) con la cascada MBID → exacto → determinístico → fuzzy, y la salvaguarda de bandas tributo — **con test real que pasa** (`test_band_matcher.py`), cubriendo el caso central del plan de pruebas.
- **Frontend**: marco general del sitio (masthead + nav persistentes + layout de dos columnas con panel lateral) implementado en componentes reutilizables (`Masthead`, `PrimaryNav`, `UtilityBar`, `PageLayout`, `SidebarCard`), tokens de Tailwind con la paleta definitiva (carbón + rojo), y dos páginas reales conectadas a la API: Home (listado con filtros) y detalle de evento (con `LineupStageList` agrupando el cartel por escenario).

## Qué falta (siguientes pasos naturales)

El desglose completo, con hitos y orden de ataque, está en `docs/Plan de Trabajo y Hitos.md`.

- Módulos de `bands`, `venues`, `moderation`, `users`, `reminders` en la API — mismo patrón que `events`, no hay decisiones de diseño pendientes, es repetir la estructura.
- Scrapers reales de Metal Archives/Metal Storm (Scrapy) y clientes de Bandsintown/MusicBrainz/Setlist.fm — el motor de matching ya está listo para recibirlos.
- OAuth (Google/Discord) — los endpoints están listados en `docs/Diseño API.md` sección 2.2, pero el flujo detallado (PKCE, vinculación de cuentas) no está documentado; falta tanto ese diseño como la integración con Passport strategies concretas.
- Resto de páginas del frontend sobre el marco ya construido: `/bandas`, `/bandas/[slug]`, `/venues`, `/venues/[slug]`, `/moderacion`, y los tres formularios de alta. No hay documento de diseño de frontend en `docs/` ni mockups en el repo: los tokens de Tailwind y el marco ya construido son la única referencia.
- **CI/CD completo**: todavía no existe `.github/` en el repo. Faltan los tres workflows de CI (API, ETL, frontend) y los tres de CD (staging/producción) — el diseño, incluidos los YAML de referencia, está en `docs/Diseño de CI CD.md`.
