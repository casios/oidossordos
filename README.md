# Agenda Metal Colaborativa

Monorepo con tres servicios, cada uno con su propio ciclo de vida (ver `diseno-cicd.md`):

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

- **Esquema de base de datos completo** (`apps/api/prisma/schema.prisma`) — todas las entidades de `schema.sql`, incluidas bandas tributo, soft delete, moderación, y las tablas de autenticación (`refresh_tokens`, `auth_tokens`, `push_subscriptions`, `system_settings`).
- **Módulo de autenticación completo**: registro, login, rotación de refresh tokens con detección de reutilización (robo de sesión), logout y logout-all. Ver `diseno-autenticacion.md` para el diseño completo.
- **Guards de autorización**: `JwtAuthGuard`, `RolesGuard` (matriz de roles), `OwnershipGuard` (contenido propio pendiente vs. publicado).
- **Filtro de excepciones** que traduce el constraint `EXCLUDE` de Postgres (choque de horario) a `409 SCHEDULE_CONFLICT`, tal como se definió en `diseno-api.md`.
- **Módulo de eventos** como referencia del patrón completo (listado con filtros, detalle, alta con moderación, alta de line-up).
- **Motor de homologación de bandas** (`apps/etl/matching/band_matcher.py`) con la cascada MBID → exacto → determinístico → fuzzy, y la salvaguarda de bandas tributo — **con test real que pasa** (`test_band_matcher.py`), cubriendo el caso central del plan de pruebas.
- **Frontend**: layout base, tokens de Tailwind (negro/gris/blanco/cobre, ya definitivos), y la página Home conectada a la API real.
- **CI**: workflows de GitHub Actions para API y ETL, tal como se diseñaron en `diseno-cicd.md`.

## Qué falta (siguientes pasos naturales)

- Módulos de `bands`, `venues`, `moderation`, `users`, `reminders` en la API — mismo patrón que `events`, no hay decisiones de diseño pendientes, es repetir la estructura.
- Scrapers reales de Metal Archives/Metal Storm (Scrapy) y clientes de Bandsintown/MusicBrainz/Setlist.fm — el motor de matching ya está listo para recibirlos.
- OAuth (Google/Discord) — el flujo está diseñado en `diseno-autenticacion.md`, falta la integración con Passport strategies concretas.
- Resto de pantallas del frontend (ya hay mockups HTML de referencia para todas en la conversación de diseño).
- Workflow de CI del frontend y los tres workflows de CD (staging/producción) de `diseno-cicd.md`.
