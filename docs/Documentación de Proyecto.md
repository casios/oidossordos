# Documentación de Proyecto — Agenda Colaborativa de Conciertos y Festivales de Metal

---

## 1. Acta de Proyecto (Project Charter)

### 1.1 Nombre del proyecto

Agenda Metal Colaborativa (nombre provisional del sistema)

### 1.2 Justificación

La información sobre conciertos y festivales de metal está fragmentada entre múltiples fuentes (Metal Archives, Metal Storm, Bandsintown, redes sociales de venues), sin homologación de identidades de bandas ni un lugar único donde la comunidad pueda consultar, marcar y recibir recordatorios de eventos. Este proyecto centraliza esa información y la enriquece con datos colaborativos.

### 1.3 Objetivo del proyecto

Desarrollar y desplegar una aplicación web que permita consultar, registrar y gestionar conciertos y festivales de metal, integrando datos de fuentes externas homologadas y funcionalidades colaborativas (likes, marcadores, recordatorios).

### 1.4 Alcance general

Incluye: scraping/ETL de fuentes externas, autenticación de usuarios, bases de datos de bandas/venues/conciertos, CRUD de conciertos, interacción social básica (likes/bookmarks), recordatorios y despliegue en producción.

No incluye (fuera de alcance en esta fase): venta de boletos propia (solo enlace externo), app móvil nativa, moderación editorial avanzada, monetización.

### 1.5 Entregables principales

1. Módulo ETL de scraping y homologación de IDs
2. Sistema de autenticación
3. Base de datos relacional (bandas, venues, géneros, conciertos)
4. API CRUD de conciertos
5. Frontend de consulta pública
6. Sistema de likes/bookmarks
7. Sistema de recordatorios
8. Aplicación desplegada en producción

### 1.6 Interesados (Stakeholders)

|Rol|Interés|
|---|---|
|Product Owner / Sponsor|Visión y priorización del producto|
|Equipo de desarrollo|Construcción técnica|
|Usuarios finales (asistentes a conciertos)|Consulta, likes, recordatorios|
|Bandas/venues (indirecto)|Visibilidad de sus eventos|

### 1.7 Supuestos

- Las fuentes externas (Metal Archives, Metal Storm, Bandsintown, MusicBrainz, Setlist.fm) permiten scraping conforme a sus términos o se usará API pública cuando exista.
- Habrá un equipo pequeño (1-4 personas) trabajando de forma incremental.

### 1.8 Restricciones

- Presupuesto de infraestructura limitado (preferencia por servicios de bajo costo/free tier en MVP).
- Dependencia de disponibilidad y estabilidad de sitios externos para scraping.
- Cumplimiento de términos de uso/robots.txt de las fuentes.

### 1.9 Criterios de éxito

- MVP funcional desplegado con al menos 100 conciertos cargados y homologados.
- Login funcional y sistema de likes/bookmarks operando sin errores críticos.
- Proceso de scraping ejecutándose de forma automatizada y programada.

---

## 2. Requerimientos

### 2.1 Requerimientos funcionales

**Gestión de identidad**

- RF-01: El sistema debe permitir el registro de usuarios (email/contraseña y OAuth).
- RF-02: El sistema debe permitir login/logout y recuperación de contraseña.

**Scraping / ETL**

- RF-03: El sistema debe extraer periódicamente información de bandas y conciertos desde Metal Archives, Metal Storm, Bandsintown, MusicBrainz y Setlist.fm.
- RF-04: El sistema debe homologar (deduplicar) bandas provenientes de distintas fuentes bajo un ID interno único, usando coincidencia de nombre, país y año de formación como criterios de matching.
- RF-05: El sistema debe registrar el origen y el ID externo de cada banda para trazabilidad.
- RF-06: El sistema debe permitir ejecución manual y programada (cron) del proceso ETL.

**Bases de datos de catálogo**

- RF-07: El sistema debe mantener un catálogo de bandas (nombre, país, género(s), año de formación, estado, biografía corta, enlaces externos), poblado tanto por el proceso ETL como por alta manual de usuarios cuando una banda no exista en el catálogo (sujeta a moderación, ver RF-19).
- RF-07c: El sistema debe permitir marcar una banda como **banda tributo/cover**, indicando opcionalmente a qué banda original tributa (si esa banda ya existe en el catálogo). Los listados y búsquedas deben permitir filtrar excluyendo o incluyendo explícitamente bandas tributo.
- RF-08: El sistema debe mantener un catálogo de venues/recintos (nombre, dirección, capacidad, coordenadas geográficas, ciudad/país), permitiendo su alta manual por parte de usuarios cuando el venue no exista en el catálogo (sujeta a moderación, ver RF-19).
- RF-09: El sistema debe mantener un catálogo de géneros musicales, permitiendo relación muchos-a-muchos con bandas.

**Conciertos/Festivales**

- RF-10: El sistema debe permitir crear, leer, actualizar y eliminar (CRUD) conciertos/festivales, tanto vía API/administración como mediante un formulario de alta accesible a usuarios autenticados desde el frontend (sujeto a moderación, ver RF-19).
- RF-11: Cada concierto debe incluir: bandas participantes, horario por banda, escenario (para festivales), venue, rango de costo de boletos, enlace externo de compra, fecha(s).
- RF-12: El sistema debe soportar eventos multi-día y multi-escenario (festivales).
- RF-12b: El formulario de alta de conciertos debe permitir seleccionar bandas y venues ya existentes en el catálogo, o iniciar el alta de una banda/venue nuevo (RF-07/RF-08) sin salir del flujo de creación del concierto.

**Interacción social**

- RF-13: Los usuarios autenticados deben poder marcar "like" en un concierto.
- RF-14: Los usuarios autenticados deben poder guardar conciertos en marcadores/bookmarks personales.

**Recordatorios**

- RF-15: El sistema debe permitir configurar recordatorios (email y/o notificación push) para conciertos marcados, con antelación configurable (ej. 1 día, 1 semana antes).
- RF-15b: El sistema debe contar con un interruptor global (a nivel de todo el sistema, gestionado por un Administrador) y un interruptor por usuario, que permitan pausar el envío de notificaciones sin eliminar la configuración de los recordatorios individuales.

**Frontend de consulta**

- RF-16: El sistema debe permitir búsqueda y filtrado de conciertos por ciudad, fecha, género y banda.
- RF-17: El sistema debe mostrar el detalle de un concierto con toda su información asociada.

**Moderación y Roles**

- RF-18: El sistema debe soportar distintos tipos de usuario con permisos diferenciados: **Administrador**, **Moderador** y **Usuario**.
    - Administrador: gestión total del sistema, incluida la asignación de roles y configuración general.
    - Moderador: revisión, aprobación/rechazo y edición de contenido colaborativo (eventos, venues, bandas).
    - Usuario: consulta, creación de contenido colaborativo (sujeto a moderación), likes, bookmarks y recordatorios.
- RF-19: El sistema debe permitir moderación de eventos, venues y bandas creados o editados por usuarios: todo contenido nuevo o modificado por un Usuario debe quedar en estado "pendiente de revisión" y no ser visible públicamente hasta ser aprobado por un Moderador o Administrador.
    - El sistema debe permitir a Moderadores/Administradores aprobar, rechazar (con motivo) o solicitar cambios sobre el contenido pendiente.
    - El sistema debe notificar al usuario creador el resultado de la revisión.
    - El contenido generado automáticamente por el proceso ETL (scraping) puede publicarse directamente o quedar sujeto a la misma cola de revisión, según se defina en configuración.

### 2.2 Requerimientos no funcionales

- RNF-01 (Rendimiento): Tiempos de respuesta de API < 500ms en el percentil 95 para consultas de listado.
- RNF-02 (Disponibilidad): Objetivo de disponibilidad del 99% para el frontend y API en producción.
- RNF-03 (Escalabilidad): La arquitectura debe permitir escalar horizontalmente el servicio de API y el worker de scraping de forma independiente.
- RNF-04 (Seguridad): Contraseñas hasheadas (bcrypt/argon2), tokens JWT con expiración, protección CSRF/XSS en frontend.
- RNF-05 (Mantenibilidad): Código versionado con Git, pruebas automatizadas mínimas en módulos críticos (auth, CRUD, matching de IDs).
- RNF-06 (Cumplimiento): El scraping debe respetar `robots.txt` y límites de tasa de las fuentes externas.
- RNF-07 (Usabilidad): Interfaz responsiva (mobile-first), dado que gran parte de la consulta ocurrirá desde celular.
- RNF-08 (Observabilidad): Registro de errores y métricas básicas de uso (logs centralizados, monitoreo de caídas).

---

## 3. WBS (Desglose de Entregables)

```
1. Gestión del Proyecto
   1.1 Definición de alcance y documentación
   1.2 Seguimiento y control

2. Infraestructura base
   2.1 Repositorio y estructura monorepo/polyrepo
   2.2 Entorno Docker Compose (local)
   2.3 Pipeline CI/CD (GitHub Actions)
   2.4 Entornos de staging y producción

3. Módulo de Autenticación
   3.1 Modelo de usuario
   3.2 Registro / Login / Recuperación de contraseña
   3.3 OAuth (Google/Discord)
   3.4 Autorización (roles: Usuario, Moderador, Administrador)

3.5 Módulo de Moderación
   3.5.1 Cola de contenido pendiente de revisión (eventos, venues, bandas)
   3.5.2 Acciones de aprobación/rechazo/solicitud de cambios
   3.5.3 Notificaciones al usuario creador sobre resultado de revisión
   3.5.4 Panel de administración para Moderadores/Administradores

4. Módulo de Datos Maestros (Bandas, Venues, Géneros)
   4.1 Modelado de base de datos (schema PostgreSQL)
   4.2 API CRUD interna de bandas/venues/géneros
   4.3 Relaciones bandas-géneros, bandas-países

5. Módulo ETL / Scraping
   5.1 Scraper Metal Archives
   5.2 Scraper Metal Storm
   5.3 Scraper/API Bandsintown
   5.3b Cliente API MusicBrainz (homologación por MBID)
   5.3c Cliente API Setlist.fm (validación de banda/venue activos, historial de shows)
   5.4 Motor de homologación de IDs (matching + deduplicación)
   5.5 Orquestación y scheduling (Celery + Redis)
   5.6 Panel/logs de ejecución de ETL

6. Módulo de Conciertos/Festivales
   6.1 Modelado de datos (concierto, escenario, horario, boletos)
   6.2 API CRUD de conciertos
   6.3 Validaciones de negocio (fechas, solapamiento de escenarios)

7. Módulo Social (Likes y Marcadores)
   7.1 Modelo de likes
   7.2 Modelo de bookmarks
   7.3 Endpoints y UI asociada

8. Módulo de Recordatorios
   8.1 Modelo de recordatorios y preferencias de usuario
   8.2 Servicio de envío de emails (Resend/SendGrid)
   8.3 Notificaciones push (Web Push)
   8.4 Job programado de disparo de recordatorios

9. Frontend de Consulta y Colaboración
   9.1 Diseño UI/UX (wireframes, sistema de diseño)
   9.2 Listado y filtros de conciertos
   9.3 Detalle de concierto
   9.4 Perfil de usuario (bookmarks, recordatorios)
   9.5 Responsive/mobile
   9.6 Formulario de alta de conciertos/festivales (bandas, horarios, escenarios, venue, boletos)
   9.7 Formulario de alta de venues/recintos
   9.8 Formulario de alta de bandas (para bandas no encontradas en el catálogo)
   9.9 Estados visuales de contenido (pendiente/aprobado/rechazado) y vista "mis aportes"

10. QA y Pruebas
    10.1 Pruebas unitarias backend
    10.2 Pruebas de integración API
    10.3 Pruebas E2E frontend
    10.4 Pruebas de carga básicas

11. Despliegue y Lanzamiento
    11.1 Despliegue frontend (Vercel)
    11.2 Despliegue backend/API (Railway/Render/Fly.io)
    11.3 Despliegue de workers de scraping
    11.4 Monitoreo y alertas (Sentry)
    11.5 Lanzamiento MVP
```

---

## 4. Plan de Hitos

Se plantea en semanas relativas al inicio del proyecto (Semana 0 = kickoff), asumiendo un equipo reducido trabajando en sprints de 2 semanas.

| Hito | Descripción                                                          | Semana estimada |
| ---- | -------------------------------------------------------------------- | --------------- |
| H1   | Kickoff, documentación aprobada, entorno base (Docker, repo, CI)     | Semana 1-2      |
| H2   | Modelo de datos maestro (bandas, venues, géneros) + auth funcional   | Semana 3-4      |
| H3   | Primer scraper funcional (una fuente) + motor de homologación básico | Semana 5-6      |
| H4   | Scrapers de las 3 fuentes integrados + scheduling automatizado       | Semana 7-8      |
| H5   | CRUD de conciertos completo (API)                                    | Semana 9-10     |
| H6   | Frontend de consulta (listado, filtros, detalle)                     | Semana 11-12    |
| H7   | Likes, bookmarks y recordatorios funcionales                         | Semana 13-14    |
| H8   | QA integral, pruebas de carga, correcciones                          | Semana 15-16    |
| H9   | Despliegue a producción y lanzamiento MVP                            | Semana 17       |
| H10  | Retrospectiva y priorización de roadmap v2                           | Semana 18       |

---

## 5. Riesgos y Mitigación

|#|Riesgo|Probabilidad|Impacto|Mitigación|
|---|---|---|---|---|
|R1|Bloqueo o cambios en estructura HTML de sitios scrapeados (Metal Archives, Metal Storm)|Alta|Alto|Diseñar scrapers desacoplados por fuente, con parsers versionados y alertas automáticas ante fallos; evaluar uso de APIs oficiales cuando existan|
|R2|Restricciones legales/términos de uso de las fuentes externas|Media|Alto|Revisar `robots.txt` y ToS de cada fuente; limitar frecuencia de requests; considerar atribución de fuente visible en la app|
|R3|Homologación incorrecta de bandas (falsos positivos/negativos en matching)|Alta|Medio|Empezar con matching conservador (nombre exacto + país); permitir revisión manual/colaborativa de duplicados; logging de decisiones de matching|
|R4|IP bloqueada por rate-limiting de Bandsintown/Metal Storm|Media|Medio|Uso de colas con backoff exponencial, rotación de user-agents, respeto de límites de tasa|
|R5|Baja adopción de usuarios (poca colaboración en datos)|Media|Medio|Priorizar UX simple, gamificación ligera (badges por aportes), fomentar comunidad en redes de metal|
|R6|Alcance creciente (scope creep) por ser proyecto colaborativo/comunitario|Alta|Medio|Congelar alcance de MVP en el Charter; nuevas features van a backlog de roadmap v2|
|R7|Costos de infraestructura crecientes con el tráfico|Baja|Medio|Empezar en tiers gratuitos/económicos (Vercel, Railway, Neon/Supabase Postgres) con monitoreo de consumo|
|R8|Falta de datos de horarios/escenarios en fuentes externas (frecuentemente incompletos)|Alta|Bajo|Permitir edición colaborativa/manual de estos campos vía CRUD|
|R9|Equipo reducido y disponibilidad limitada de tiempo|Media|Alto|Priorización estricta vía roadmap, entregas incrementales, MVP recortado si es necesario|

---

## 6. Roadmap Inicial

### Fase 0 — Fundacional (Semanas 1-4)

- Documentación, arquitectura, entorno de desarrollo
- Modelo de datos maestro y autenticación

### Fase 1 — MVP de Datos (Semanas 5-10)

- ETL funcional de las 3 fuentes con homologación de IDs
- CRUD de conciertos vía API

### Fase 2 — MVP de Producto (Semanas 11-16)

- Frontend de consulta pública
- Likes, bookmarks, recordatorios
- QA y pruebas

### Fase 3 — Lanzamiento (Semana 17-18)

- Despliegue en producción
- Lanzamiento a comunidad inicial (beta cerrada)

### Fase 4 — Roadmap v2 (post-lanzamiento, backlog priorizable)

- Edición colaborativa tipo wiki (historial de cambios, moderación)
- Búsqueda avanzada (Meilisearch/Elasticsearch)
- App móvil (PWA o nativa)
- Integración de mapa interactivo de venues
- Sistema de reputación/roles de colaborador
- Soporte multilenguaje
- Integración con calendarios (Google Calendar/iCal export)
- Notificaciones por cercanía geográfica

---

## 7. Arquitectura Tecnológica

### 7.1 Vista de componentes

```
┌─────────────────────────┐
│        Frontend         │
│   Next.js + TypeScript  │
│   (SSR/SSG, Tailwind)   │
└───────────┬──────────────┘
            │ REST/GraphQL (HTTPS)
┌───────────▼──────────────┐
│        API Backend       │
│   NestJS (Node.js/TS)    │
│  - Auth (JWT/OAuth)      │
│  - CRUD Conciertos       │
│  - Likes/Bookmarks       │
│  - Recordatorios (API)   │
└─────┬─────────────┬───────┘
      │             │
      │             │ Encola tareas
┌─────▼─────┐  ┌────▼──────────────┐
│ PostgreSQL │  │  Redis (cache +   │
│ (datos     │  │  colas Celery)    │
│ maestro)   │  └────┬──────────────┘
└────────────┘       │
                ┌─────▼──────────────────┐
                │  Workers Python/Celery │
                │  - Scraper MetalArchives│
                │  - Scraper MetalStorm  │
                │  - Cliente Bandsintown │
                │  - Cliente MusicBrainz │
                │  - Cliente Setlist.fm  │
                │  - Motor de matching/  │
                │    homologación de IDs │
                │  - Job de recordatorios│
                └─────┬──────────────────┘
                      │
             ┌────────▼─────────┐
             │ Servicios externos│
             │ Email (Resend)    │
             │ Push (Web Push)   │
             │ Storage (S3/R2)   │
             └───────────────────┘
```

### 7.2 Flujo de datos ETL (homologación de IDs)

1. Worker programado (cron/Celery beat) dispara scraping por fuente.
2. Cada scraper extrae datos crudos y los normaliza a un esquema común (nombre, país, género, año, id_externo, fuente).
3. El motor de matching busca coincidencias en la tabla `bands` mediante:
    - Coincidencia exacta de nombre + país
    - Fuzzy matching (similitud de texto) como respaldo
4. Si hay coincidencia: se agrega el id externo a la tabla `band_external_ids` (relación banda interna ↔ fuente ↔ id externo).
5. Si no hay coincidencia: se crea una nueva banda con estado "pendiente de revisión" si la confianza del matching es baja.
6. Los conciertos extraídos se vinculan a bandas ya homologadas mediante su ID interno.

### 7.3 Modelo de datos (entidades principales, alto nivel)

- `users` (id, email, password_hash, oauth_provider, role[usuario/moderador/administrador], created_at)
- `bands` (id, name, country, formed_year, bio, status[pendiente/aprobado/rechazado], created_by, reviewed_by)
- `band_external_ids` (band_id, source, external_id, url)
- `genres` (id, name)
- `band_genres` (band_id, genre_id)
- `venues` (id, name, address, city, country, lat, lng, capacity, status[pendiente/aprobado/rechazado], created_by, reviewed_by)
- `events` (id, name, type[concierto/festival], start_date, end_date, venue_id, status[pendiente/aprobado/rechazado], created_by, reviewed_by)
- `moderation_log` (id, entity_type[event/venue/band], entity_id, action[aprobado/rechazado/cambios_solicitados], reason, reviewer_id, created_at)
- `event_bands` (event_id, band_id, stage, start_time, end_time)
- `tickets_info` (event_id, price_min, price_max, external_url)
- `likes` (user_id, event_id, created_at)
- `bookmarks` (user_id, event_id, created_at)
- `reminders` (user_id, event_id, remind_before, channel[email/push], sent_at)

### 7.4 Consideraciones de despliegue

- Frontend: Vercel (despliegue continuo desde `main`, preview deployments por PR)
- API/Backend: contenedor Docker desplegado en Railway/Render/Fly.io
- Workers de scraping: contenedor separado (misma plataforma), con variable de entorno para scheduling independiente
- Base de datos: PostgreSQL gestionado (Neon, Supabase o RDS en fase de escalamiento)
- Secretos y variables de entorno gestionados vía el proveedor de despliegue (nunca en repositorio)
- CI/CD: GitHub Actions ejecuta tests + build en cada PR; despliegue automático en merge a `main` para staging, manual/aprobado para producción