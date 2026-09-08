# Diseño de API — Agenda Metal Colaborativa

Estilo: **REST sobre JSON**, servido por NestJS. Se elige REST sobre GraphQL para este proyecto porque los recursos son mayormente jerárquicos y predecibles (evento → line-up → banda/escenario), y el equipo reducido se beneficia de la simplicidad de debugging/caching HTTP estándar sobre la flexibilidad de queries que GraphQL ofrece pero que aquí no se necesita.

Base URL: `https://api.agendametal.app/api/v1`

---

## 1. Convenciones generales

### 1.1 Versionado

Versionado por URI: `/api/v1/...`. Cambios incompatibles crean `/api/v2` en paralelo; no se rompen contratos dentro de una versión.

### 1.2 Formato de respuesta exitosa

Recurso único:

```json
{
  "data": { "id": "...", "...": "..." }
}
```

Colección paginada:

```json
{
  "data": [ { "...": "..." } ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 134,
    "totalPages": 7
  }
}
```

### 1.3 Formato de error estándar

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El campo start_date es requerido",
    "details": [
      { "field": "start_date", "issue": "required" }
    ]
  }
}
```

Códigos HTTP usados: `200` OK, `201` Created, `204` No Content, `400` Bad Request, `401` Unauthorized, `403` Forbidden, `404` Not Found, `409` Conflict (ej. slug duplicado, choque de horario), `422` Unprocessable Entity (validación de negocio), `429` Too Many Requests.

### 1.4 Paginación, filtros y orden

Query params estándar en listados:

- `page`, `limit` (default `20`, máx `100`)
- `sort` — ej. `sort=start_date:asc`, `sort=name:desc`
- `q` — búsqueda de texto libre (usa el índice `pg_trgm`)
- Filtros específicos por recurso (ver cada módulo)

### 1.5 Rate limiting

- Endpoints públicos de lectura: 100 req/min por IP.
- Endpoints autenticados de escritura: 30 req/min por usuario.
- `POST /etl/runs/trigger`: 1 req/min (protección adicional, solo administradores).

---

## 2. Autenticación y autorización

### 2.1 Mecanismo

JWT de acceso (corta duración, 15 min) + refresh token (7 días, rotativo, almacenado como `httpOnly` cookie). El access token va en `Authorization: Bearer <token>`. Detalle completo del flujo (rotación, detección de reutilización de refresh token, OAuth con PKCE, recuperación de contraseña) en `diseno-autenticacion.md`.

Payload del JWT de acceso:

```json
{ "sub": "user-uuid", "role": "moderador", "iat": 0, "exp": 0 }
```

### 2.2 Endpoints de autenticación

|Método|Ruta|Descripción|Auth|
|---|---|---|---|
|POST|`/auth/register`|Registro con email/contraseña|Pública|
|POST|`/auth/login`|Login, devuelve access + refresh token|Pública|
|POST|`/auth/refresh`|Renueva access token con refresh token|Refresh token|
|POST|`/auth/logout`|Invalida refresh token actual|Autenticado|
|POST|`/auth/logout-all`|Invalida todas las sesiones activas del usuario (todas las `family_id`)|Autenticado|
|GET|`/auth/verify-email`|Confirma el correo con el token enviado al registrarse|Pública (con token)|
|GET|`/auth/oauth/google`|Redirección a OAuth Google|Pública|
|GET|`/auth/oauth/google/callback`|Callback OAuth Google|Pública|
|GET|`/auth/oauth/discord` / `/callback`|Igual, para Discord|Pública|
|POST|`/auth/forgot-password`|Solicita email de recuperación|Pública|
|POST|`/auth/reset-password`|Restablece contraseña con token|Pública (con token)|
|GET|`/auth/me`|Perfil del usuario autenticado|Autenticado|

### 2.3 Matriz de autorización por rol

|Acción|Usuario|Moderador|Administrador|
|---|---|---|---|
|Consultar catálogos/eventos aprobados|✅|✅|✅|
|Crear banda/venue/evento (queda `pendiente`)|✅|✅|✅|
|Editar su propio contenido `pendiente`|✅|✅|✅|
|Editar contenido de otros usuarios|❌|✅|✅|
|Ver cola de moderación|❌|✅|✅|
|Aprobar/rechazar contenido|❌|✅|✅|
|Eliminar contenido publicado|❌|❌|✅|
|Asignar/cambiar roles de usuario|❌|❌|✅|
|Disparar ejecución manual de ETL|❌|❌|✅|
|Ver historial de ejecuciones ETL|❌|✅ (solo lectura)|✅|

Implementado con un `RolesGuard` de NestJS (`@Roles('moderador', 'administrador')`) + un `OwnershipGuard` para el caso "su propio contenido".

---

## 3. Endpoints por módulo

### 3.1 Usuarios

|Método|Ruta|Descripción|Auth|
|---|---|---|---|
|GET|`/users`|Lista de usuarios (filtro `role`)|Administrador|
|GET|`/users/:id`|Detalle de usuario|Administrador|
|PATCH|`/users/me`|Actualizar propio perfil|Autenticado|
|PATCH|`/users/:id/role`|Cambiar rol de un usuario|Administrador|
|GET|`/users/me/contributions`|Bandas/venues/eventos creados por mí y su estado de moderación|Autenticado|
|GET|`/users/me/bookmarks`|Mis eventos guardados|Autenticado|
|GET|`/users/me/reminders`|Mis recordatorios configurados|Autenticado|

### 3.2 Géneros

|Método|Ruta|Descripción|Auth|
|---|---|---|---|
|GET|`/genres`|Lista de géneros|Pública|
|POST|`/genres`|Crear género|Moderador+|
|PATCH|`/genres/:id`|Editar género|Moderador+|
|DELETE|`/genres/:id`|Eliminar género|Administrador|

### 3.3 Bandas

|Método|Ruta|Descripción|Auth|
|---|---|---|---|
|GET|`/bands`|Lista (filtros: `genre`, `country`, `status`, `is_tribute`, `q`) — público solo ve `status=aprobado`; por defecto excluye tributos salvo que se pida `is_tribute=true` o `is_tribute=all`|Pública/Autenticado|
|GET|`/bands/:idOrSlug`|Detalle de banda (incluye `band_external_ids`, géneros, `is_tribute`/`tribute_of_band_id`si aplica)|Pública (si aprobada)|
|POST|`/bands`|Alta de banda (RF-07) → `status=pendiente`|Autenticado|
|PATCH|`/bands/:id`|Editar banda|Dueño (si pendiente) / Moderador+|
|DELETE|`/bands/:id`|Borrado suave (`deleted_at`)|Administrador|
|POST|`/bands/:id/restore`|Revertir borrado suave|Administrador|

### 3.4 Venues y escenarios

|Método|Ruta|Descripción|Auth|
|---|---|---|---|
|GET|`/venues`|Lista (filtros: `city`, `country`, `q`)|Pública/Autenticado|
|GET|`/venues/:idOrSlug`|Detalle de venue (incluye `stages`)|Pública (si aprobado)|
|POST|`/venues`|Alta de venue (RF-08) → `status=pendiente`|Autenticado|
|PATCH|`/venues/:id`|Editar venue|Dueño (si pendiente) / Moderador+|
|DELETE|`/venues/:id`|Borrado suave (`deleted_at`)|Administrador|
|POST|`/venues/:id/restore`|Revertir borrado suave|Administrador|
|GET|`/venues/:id/stages`|Escenarios físicos del venue|Pública|
|POST|`/venues/:id/stages`|Crear escenario físico|Moderador+|
|PATCH|`/venues/:id/stages/:stageId`|Editar escenario|Moderador+|

### 3.5 Eventos (conciertos/festivales)

|Método|Ruta|Descripción|Auth|
|---|---|---|---|
|GET|`/events`|Lista (filtros: `city`, `from`, `to`, `genre`, `band`, `q`, `status`, `is_tribute`) — público solo ve `aprobado`; `is_tribute` es un filtro derivado (evento con al menos una banda tributo en el line-up), útil para excluir shows de covers de resultados de búsqueda por defecto|Pública/Autenticado|
|GET|`/events/:idOrSlug`|Detalle completo: venue, escenarios activos, line-up, boletos, contadores de like|Pública (si aprobado)|
|POST|`/events`|Alta de evento (RF-10) → `status=pendiente`|Autenticado|
|PATCH|`/events/:id`|Editar datos generales del evento|Dueño (si pendiente) / Moderador+|
|DELETE|`/events/:id`|Borrado suave (`deleted_at`)|Administrador|
|POST|`/events/:id/restore`|Revertir borrado suave|Administrador|
|GET|`/events/:id/stages`|Escenarios activos en esta edición (`event_stages`)|Pública|
|POST|`/events/:id/stages`|Activar un escenario del venue para este evento (`stage_id`, `display_name`, `sort_order`)|Dueño/Moderador+|
|GET|`/events/:id/lineup`|Line-up completo (banda, escenario, horario, orden de cartel)|Pública|
|POST|`/events/:id/lineup`|Agregar banda al line-up (RF-12b: permite `band_id` existente o disparar alta de banda nueva)|Dueño/Moderador+|
|PATCH|`/events/:id/lineup/:lineupId`|Editar horario/escenario/orden de una entrada del line-up|Dueño/Moderador+|
|DELETE|`/events/:id/lineup/:lineupId`|Quitar banda del line-up|Dueño/Moderador+|
|PUT|`/events/:id/tickets`|Crear/actualizar información de boletos|Dueño/Moderador+|

### 3.6 Interacción social

|Método|Ruta|Descripción|Auth|
|---|---|---|---|
|POST|`/events/:id/like`|Dar like|Autenticado|
|DELETE|`/events/:id/like`|Quitar like|Autenticado|
|GET|`/events/:id/likes/count`|Conteo de likes|Pública|
|POST|`/events/:id/bookmark`|Guardar en marcadores|Autenticado|
|DELETE|`/events/:id/bookmark`|Quitar de marcadores|Autenticado|

### 3.7 Recordatorios

|Método|Ruta|Descripción|Auth|
|---|---|---|---|
|POST|`/events/:id/reminders`|Crear recordatorio (`channel`, `remind_before`)|Autenticado|
|DELETE|`/reminders/:id`|Eliminar recordatorio propio|Autenticado (dueño)|
|PATCH|`/users/me/notifications-pause`|Interruptor por usuario — pausa/reanuda **todas** sus notificaciones sin borrar los recordatorios (`{ "paused": true\|false }`)|Autenticado|
|POST|`/users/me/push-subscriptions`|Registrar suscripción push del dispositivo actual|Autenticado|
|DELETE|`/users/me/push-subscriptions/:id`|Eliminar una suscripción push|Autenticado (dueño)|
|GET|`/admin/settings`|Ver configuración del sistema (incluye `notifications_enabled`)|Administrador|
|PATCH|`/admin/settings/notifications`|**Interruptor global** — detiene el envío de notificaciones a todos los usuarios (`{ "enabled": false }`)|Administrador|

Detalle completo del worker, la lógica de expiración tras una pausa larga, y el manejo de suscripciones push caídas, en `diseno-recordatorios.md`.

### 3.8 Moderación

|Método|Ruta|Descripción|Auth|
|---|---|---|---|
|GET|`/moderation/queue`|Cola de contenido pendiente (filtros: `entity_type`)|Moderador+|
|GET|`/moderation/log`|Historial de decisiones (filtros: `entity_type`, `entity_id`)|Moderador+|
|POST|`/moderation/:entityType/:id/approve`|Aprobar y publicar|Moderador+|
|POST|`/moderation/:entityType/:id/reject`|Rechazar (body: `reason`)|Moderador+|
|POST|`/moderation/:entityType/:id/request-changes`|Solicitar cambios (body: `reason`)|Moderador+|

`entityType` ∈ `{band, venue, event}`.

### 3.9 ETL / Scraping

|Método|Ruta|Descripción|Auth|
|---|---|---|---|
|GET|`/etl/runs`|Historial de ejecuciones (filtro `source`)|Moderador+ (lectura)|
|POST|`/etl/runs/trigger`|Disparo manual (body: `source`)|Administrador|
|GET|`/etl/runs/:id`|Detalle de una ejecución (contadores, log de errores)|Moderador+|

---

## 4. Ejemplos de contrato (payloads)

### 4.1 Crear un evento con line-up (flujo típico del formulario de alta, RF-10/RF-12b)

`POST /events`

```json
{
  "name": "Hell and Heaven 2027",
  "type": "festival",
  "description": "Festival de metal en el Estado de México",
  "start_date": "2027-04-16",
  "end_date": "2027-04-18",
  "venue_id": "b3f1c2a0-...-venue"
}
```

Respuesta `201`:

```json
{
  "data": {
    "id": "e7a1...",
    "slug": "hell-and-heaven-2027",
    "status": "pendiente",
    "created_by": "user-uuid",
    "...": "..."
  }
}
```

`POST /events/e7a1.../stages`

```json
{ "stage_id": "stage-uuid-escenario-principal", "display_name": "Escenario Corona", "sort_order": 1 }
```

`POST /events/e7a1.../lineup`

```json
{
  "band_id": "band-uuid-gojira",
  "event_stage_id": "event-stage-uuid",
  "start_time": "2027-04-17T21:00:00-06:00",
  "end_time": "2027-04-17T22:30:00-06:00",
  "billing_order": 1
}
```

Si la banda no existe en el catálogo, el frontend primero llama a `POST /bands` y usa el `id` devuelto aquí — sin salir del flujo (RF-12b).

Si el horario se solapa con otra banda en el mismo `event_stage_id`, la API responde:

```json
{
  "error": {
    "code": "SCHEDULE_CONFLICT",
    "message": "Ya existe una banda programada en este escenario en ese horario"
  }
}
```

`409 Conflict` — mapeado directamente desde la restricción `EXCLUDE` de PostgreSQL.

### 4.2 Cola de moderación

`GET /moderation/queue?entity_type=event&page=1&limit=20`

```json
{
  "data": [
    {
      "entity_type": "event",
      "entity_id": "e7a1...",
      "name": "Hell and Heaven 2027",
      "created_by": { "id": "user-uuid", "display_name": "..." },
      "created_at": "2026-07-20T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 4, "totalPages": 1 }
}
```

`POST /moderation/event/e7a1.../reject`

```json
{ "reason": "Falta información de venue verificable" }
```

---

## 5. Consideraciones adicionales

- **Idempotencia en ETL**: `POST /etl/runs/trigger` debe rechazar (`409`) si ya hay una ejecución `en curso` para la misma `source`, para evitar disparos duplicados.
- **Soft delete implementado**: `DELETE` en bandas/venues/eventos es lógico (`deleted_at`/`deleted_by`), no físico — se preserva el historial de likes, bookmarks y line-ups. Todos los listados y detalles públicos deben filtrar `deleted_at IS NULL` por defecto; el filtro `status=deleted` (o un flag `includeDeleted=true`) solo está disponible para Administrador, junto con el endpoint `POST /.../restore` para revertir el borrado.
- **Recordatorios y eventos borrados**: el worker que dispara recordatorios (`reminders` con `sent_at IS NULL`) debe excluir eventos con `deleted_at IS NOT NULL` para no notificar sobre un evento que fue removido.
- **Webhooks (futuro, roadmap v2)**: considerar `POST /webhooks/bandsintown` si Bandsintown ofrece push en vez de solo scraping/polling.
- **Documentación**: generar OpenAPI/Swagger automáticamente desde los decoradores de NestJS (`@nestjs/swagger`), expuesto en `/api/v1/docs`.