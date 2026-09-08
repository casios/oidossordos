# Diseño de CI/CD

Cubre WBS 2.3 (pipeline CI/CD), 2.4 (entornos) y 11 (despliegue). Tres servicios con necesidades distintas: frontend (Next.js), API (NestJS) y ETL (Python/Celery) — cada uno con su propio pipeline, no uno monolítico.

---

## 1. Estrategia de ramas

- **Trunk-based simplificado**: `main` siempre desplegable. Feature branches cortas (`feat/...`, `fix/...`) con PR obligatorio hacia `main`.
- `main` protegida: requiere PR aprobado + CI en verde para mergear (sin push directo, ni siquiera de Administradores del repo).
- Sin rama `develop` separada — dado el tamaño del equipo (WBS asume 1-4 personas), una rama de integración adicional agrega overhead sin beneficio real; `main` protegida + CI cumple el mismo rol.

---

## 2. Pipeline de CI (por servicio)

Los tres corren en paralelo en el mismo workflow de GitHub Actions, activados solo si hay cambios en su carpeta respectiva (`paths:` filter) — evita correr tests de Python en un PR que solo tocó el frontend.

### 2.1 Frontend (Next.js)

1. Instalar dependencias (`npm ci`, con caché de `node_modules` por lockfile hash)
2. Lint (`eslint`) + type-check (`tsc --noEmit`)
3. Tests unitarios de componentes (Jest/Testing Library)
4. Build (`next build`) — falla el PR si el build falla, antes de que Vercel intente desplegarlo

### 2.2 API (NestJS)

1. Instalar dependencias
2. Lint + type-check
3. Tests unitarios (Jest)
4. **Tests de integración contra Postgres real** (no mocks) — usa un `service container` de Postgres efímero dentro del propio job de GitHub Actions
5. Build (`nest build`)

### 2.3 ETL (Python/Celery)

1. Instalar dependencias (`pip install -r requirements.txt`)
2. Lint (`ruff`) + type-check (`mypy`)
3. Tests unitarios (`pytest`) — incluye los casos de la sección 2.3/2.4 del plan de pruebas (salvaguarda de bandas tributo, idempotencia de UPSERT, circuit breaker)
4. Build de imagen Docker (el ETL sí se empaqueta en contenedor, a diferencia del frontend/API que se despliegan directo desde el build)

### 2.4 Ejemplo concreto — CI del API con Postgres de prueba

```yaml
# .github/workflows/ci-api.yml
name: CI - API
on:
  pull_request:
    paths: ['apps/api/**']
  push:
    branches: [main]
    paths: ['apps/api/**']

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: agenda_metal_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
        working-directory: apps/api
      - run: npm run lint
        working-directory: apps/api
      - run: npm run migration:run
        working-directory: apps/api
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/agenda_metal_test
      - run: npm run test:unit
        working-directory: apps/api
      - run: npm run test:integration
        working-directory: apps/api
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/agenda_metal_test
      - run: npm run build
        working-directory: apps/api
```

---

## 3. Pipeline de CD (despliegue)

|Servicio|Plataforma|Mecanismo|
|---|---|---|
|Frontend|Vercel|Integración nativa de Vercel con GitHub — cada push a una rama genera un _preview deployment_ automático; merge a `main` despliega a producción. No requiere workflow de GitHub Actions propio para esto.|
|API (NestJS)|Railway / Render / Fly.io|Workflow de GitHub Actions: build de imagen Docker → push al registro → trigger de deploy en la plataforma vía su CLI/API|
|ETL (Python/Celery)|Misma plataforma que la API, servicio separado|Mismo mecanismo que la API, imagen Docker distinta|

### 3.1 Staging vs. producción

- **Merge a `main`** → deploy automático e inmediato a **staging**.
- **Deploy a producción**: requiere aprobación manual — se implementa con un GitHub _Environment_ llamado `production` con _required reviewers_ configurados. El workflow de deploy a producción se dispara (ej. por tag `v*` o manualmente vía `workflow_dispatch`), pero **queda pausado** esperando que alguien del equipo apruebe desde la UI de GitHub antes de ejecutar el paso real de deploy.
- Esto es _Continuous Delivery_, no _Continuous Deployment_ puro — deliberado para un proyecto en fase temprana donde un bug en producción (ej. un cambio de esquema mal migrado) tiene más costo que la fricción de un clic de aprobación.

### 3.2 Migraciones de base de datos

- Las migraciones (TypeORM) corren como **paso explícito y separado** antes del deploy de la nueva versión de la API, nunca automáticamente al arrancar el contenedor — evita que dos instancias del API arrancando en paralelo corran la misma migración dos veces.
- Migraciones **aditivas primero**: agregar una columna nullable en un deploy, y solo en un deploy posterior hacerla `NOT NULL`/eliminar la columna vieja — permite que la versión anterior del código siga funcionando durante el rollout (zero-downtime deploys).
- Rollback de una migración fallida: el pipeline de producción corre `migration:run` y, si falla, **no continúa** al paso de deploy del nuevo código — la versión vieja sigue sirviendo tráfico contra el esquema viejo sin corromper datos a medias.

---

## 4. Gestión de secretos

- Nunca en el repositorio (ni en `.env` commiteado, ni en el propio YAML del workflow).
- **GitHub Secrets** a nivel de repositorio para credenciales de CI (ej. token de Vercel, credenciales del registro Docker).
- **GitHub Environments** (`staging`, `production`) con secretos propios por ambiente — la `DATABASE_URL` de staging y la de producción son secretos distintos, nunca el mismo valor con un flag de ambiente.
- Variables sensibles del propio runtime de la app (JWT signing key, credenciales OAuth de Google/Discord, `app_id`de Bandsintown, API keys de MusicBrainz/Setlist.fm, credenciales de Resend/SendGrid, VAPID keys de Web Push) se inyectan como variables de entorno en la plataforma de despliegue (Railway/Render/Fly.io/Vercel), no se leen desde GitHub Secrets en runtime — GitHub Secrets solo se usan durante el _proceso_ de CI/CD, no en producción corriendo.

---

## 5. Feature flags como red de seguridad adicional

La tabla `system_settings` que ya diseñamos para el interruptor global de notificaciones es reutilizable como mecanismo general de _feature flag_: un cambio riesgoso (ej. activar un nuevo scraper, cambiar el algoritmo de matching) puede desplegarse **apagado por defecto** vía una clave nueva en `system_settings`, y activarse en producción sin necesitar un nuevo deploy — reduce la necesidad de rollbacks de código para funcionalidades nuevas que resultan problemáticas.

---

## 6. Monitoreo post-deploy

- **Smoke tests** (ya definidos en el plan de pruebas, sección 4): tras cada deploy a producción, un job corre automáticamente `GET /health`, un login de cuenta de prueba dedicada, y un `GET /events` de control — si cualquiera falla, se notifica al equipo de inmediato (no se espera a que un usuario real reporte el problema).
- **Sentry** conectado tanto al frontend como al API — cada deploy se marca como un "release" en Sentry, de forma que un pico de errores se puede correlacionar directamente con el deploy que lo causó.
- **Rollback rápido**: dado que Vercel mantiene preview deployments inmutables y Railway/Render permiten volver a un deploy anterior con un clic, el rollback de código es casi instantáneo; el caso que requiere cuidado real es el rollback de una migración de base de datos (cubierto en 3.2).

---

## 7. Resumen del flujo completo

```
Developer abre PR
  → CI corre (lint, tests, build) solo para los servicios que cambiaron
  → Review + aprobación humana
  → Merge a main
  → Deploy automático a staging (los 3 servicios)
  → Smoke tests en staging
  → Tag de release (ej. v1.4.0) o trigger manual
  → Espera aprobación humana (GitHub Environment "production")
  → Migración de base de datos en producción
  → Deploy a producción (los 3 servicios)
  → Smoke tests en producción
  → Sentry marca el release; monitoreo activo las siguientes horas
```