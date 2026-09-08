# Plan de Trabajo y Hitos — actualizado

**Fecha de corte: 4 de septiembre de 2026.** Reemplaza al plan de hitos original (`Documentación de Proyecto.md` secciones 4 y 6), que sigue siendo válido como registro de la planeación inicial pero ya no refleja el estado del repo. La numeración de entregables (WBS x.y) y de requerimientos (RF-XX) se conserva para poder cruzar ambos documentos.

Este plan se levantó revisando el código, no la documentación: cada afirmación de "hecho" apunta al archivo que lo respalda.

---

## 1. Resumen de estatus

El proyecto tiene **el diseño muy por delante de la implementación**, y dentro de la implementación, **el backend por delante de todo lo demás**. Lo construido está bien construido: las decisiones difíciles (rotación de refresh tokens, constraint de choque de horario, salvaguarda de tributos) están resueltas y son las que normalmente cuesta más trabajo retomar.

Tres bloqueos concretos, en orden de gravedad:

1. **No hay forma de aprobar contenido.** Todo nace en `status=pendiente` (`events.service.ts:create`) y los listados públicos filtran `status: 'aprobado'` (`events.service.ts:list`). Sin el módulo de moderación, **nada de lo que capture un usuario puede volverse visible jamás**. Hoy la app solo podría mostrar filas aprobadas a mano en la base de datos. Es el camino crítico del MVP, no un módulo más de la lista.
2. **El ETL no puede correr.** `celery_app.py` agenda cinco tareas (`tasks.bandsintown.run`, `tasks.setlist_fm.run`, `tasks.metal_archives.run`, `tasks.metal_storm.run`, `tasks.reminders.dispatch`) y el paquete `apps/etl/tasks/` está vacío: beat falla al despachar. El motor de matching, que es la pieza difícil, sí está listo y probado.
3. **No hay red de seguridad.** No existe `.github/`, y los scripts `test:unit` de API y web no tienen ni un archivo de prueba ni configuración de jest. El único test real del repo es `apps/etl/matching/test_band_matcher.py`, y `pytest` ni siquiera está en `requirements.txt`.

### Estado por entregable

| WBS | Entregable | Estado | Evidencia |
|---|---|---|---|
| 2.1 | Monorepo | ✅ | `apps/{web,api,etl}`, sin workspaces |
| 2.2 | Docker Compose local | ✅ | `docker-compose.yml`, Postgres en 5433 (host) |
| 2.3 | Pipeline CI/CD | ⚠️ | CI de los tres servicios en `.github/workflows/`; CD sin empezar |
| 2.4 | Staging y producción | ❌ | — |
| 3.1 | Modelo de usuario | ✅ | `schema.prisma` (`users`, `refresh_tokens`, `auth_tokens`) |
| 3.2 | Registro / login / recuperación | ⚠️ | registro, login, refresh, logout y logout-all en `auth.service.ts`; faltan verificación de email, forgot/reset password y `GET /auth/me` |
| 3.3 | OAuth Google/Discord | ❌ | columnas en BD y variables en `.env.example`, sin implementación |
| 3.4 | Autorización por roles | ✅ | `RolesGuard`, `OwnershipGuard`, `JwtAuthGuard` |
| 3.5 | Módulo de moderación | ❌ | **bloqueante** — ver punto 1 |
| 4.1 | Modelado de BD | ✅ | `schema.prisma` + `manual-constraints.sql` + migración `20260815070656_init`; `schema.prisma` va adelante de `Schema SQL.md` en las 4 tablas de auth |
| 4.2 | API CRUD bandas/venues/géneros | ❌ | — |
| 4.3 | Relaciones banda-género/país | ✅ (esquema) | `band_genres`, `bands.country` |
| 5.1–5.3c | Scrapers y clientes de API | ❌ | `apps/etl/tasks/` vacío |
| 5.4 | Motor de homologación | ✅ | `band_matcher.py` + test |
| 5.5 | Orquestación Celery | ⚠️ | beat configurado, apunta a tareas inexistentes |
| 5.6 | Logs de ejecución ETL | ⚠️ | tabla `etl_runs` en el esquema, sin escritura ni panel |
| 6.1 | Modelado de conciertos | ✅ | `events`, `event_stages`, `event_bands`, `ticket_info` |
| 6.2 | API CRUD de conciertos | ⚠️ | listado, detalle, alta y alta de line-up; faltan edición y borrado lógico |
| 6.3 | Validaciones de negocio | ✅ | `excl_stage_time_overlap` + `PrismaExceptionFilter` → 409 |
| 7 | Likes y bookmarks | ❌ | tablas en el esquema, sin endpoints ni UI |
| 8 | Recordatorios | ❌ | tablas y diseño completo, sin implementación |
| 9.1 | Diseño UI/UX | ⚠️ | tokens y marco implementados; **sin documento de diseño** |
| 9.2–9.3 | Listado, filtros, detalle | ✅ | `app/page.tsx`, `app/eventos/[slug]/page.tsx` |
| 9.4–9.9 | Perfil, formularios de alta, estados | ❌ | — |
| 10.1 | Pruebas unitarias backend | ⚠️ | 17 en la API (guards + filtro), 2 en el ETL; falta cubrir services |
| 10.2–10.4 | Integración, E2E, carga | ❌ | scripts en su lugar, pasando en vacío |
| 11 | Despliegue | ❌ | — |

### Deuda documental

Tres documentos que el propio diseño da por existentes **nunca se escribieron**, y su ausencia ya está costando decisiones:

| Documento faltante | Quién lo cita | Qué se perdió |
|---|---|---|
| `diseno-autenticacion.md` | `Diseño API.md:76`, `auth.service.ts` (×4), `app.module.ts`, `jwt-auth.guard.ts` | flujo OAuth con PKCE, recuperación de contraseña, decisión RS256 vs. HS256 en producción |
| `diseno-frontend.md` | `tailwind.config.ts:2` | sistema de diseño, mapa del sitio, la "Propuesta A" que el marco ya implementa |
| `plan-de-pruebas.md` | `Diseño de CI CD.md:38` | qué debe correr el CI del ETL; hoy solo lo define el propio test |

Las 21 referencias a nombres de archivo inexistentes que había en comentarios de `apps/` ya están corregidas (2026-09-04). Al hacerlo aparecieron tres citas que apuntaban a contenido que no existe, no solo a un nombre mal escrito, y quedaron anotadas en el código: la **decisión 12** del doc de base de datos (sus decisiones llegan a la 11) que respaldaba el soft delete; la **sección 5** del mismo doc (solo tiene 4 secciones) que respaldaba el constraint `EXCLUDE`; y el **par de llaves RS256** para producción, que no está escrito en ningún lado.

---

## 2. Plan de trabajo

**Supuestos** (ajústalos si no aplican, cambian todas las fechas): equipo reducido, sprints de 2 semanas, Semana 1 = semana del 7 de septiembre de 2026. Las semanas son relativas a la reanudación, no al kickoff original.

**Criterio de orden**: primero lo que desbloquea el flujo completo de un dato (capturar → aprobar → ver publicado), después lo que lo alimenta automáticamente (ETL), al final lo que lo enriquece (social, recordatorios). La infraestructura de pruebas va al inicio porque el costo de retrofitearla crece con cada módulo.

| Hito | Descripción | Entregables (WBS) | Criterio de aceptación | Semana |
|---|---|---|---|---|
| ~~**M1**~~ | ~~Red de seguridad y saneamiento~~ | 2.3, 10.1 | **Completado el 7 de septiembre de 2026.** CI de los tres servicios; `requirements-dev.txt` con pytest y ruff; jest en la API con 17 pruebas (tres guards + filtro); eslint en API y web; referencias a docs corregidas | ~~1-2~~ |
| **M2** | Flujo de contenido de punta a punta | 3.5, 4.2 | Un usuario captura una banda, un moderador la aprueba y aparece en el listado público, sin tocar la base de datos a mano. Incluye `bands` y `venues` con el patrón de `events`, cola de moderación y `moderation_log` escribiéndose | 3-5 |
| **M3** | Auth completo | 3.2, 3.3 | Verificación de email, forgot/reset password, `GET /auth/me` y OAuth Google/Discord funcionando. **Requiere escribir antes `diseno-autenticacion.md`** — decidir PKCE y vinculación de cuentas en el código es cómo se acumula deuda | 6-7 |
| **M4** | Primer scraper en producción | 5.1, 5.5, 5.6 | `apps/etl/tasks/` con una fuente real end-to-end: extracción → normalización → `match_band` → escritura con `status=pendiente` → fila en `etl_runs`. Beat deja de fallar | 8-9 |
| **M5** | Resto de fuentes | 5.2, 5.3, 5.3b, 5.3c | Las cinco fuentes integradas, con backoff y rate-limiting (riesgo R4 del acta) | 10-11 |
| **M6** | Frontend colaborativo | 9.4, 9.6–9.9 | Los tres formularios de alta, "mis aportes" con estados pendiente/aprobado/rechazado, y el panel de moderación. **Requiere escribir antes `diseno-frontend.md`** | 12-14 |
| **M7** | Social y recordatorios | 7, 8 | Likes, bookmarks, recordatorios por email y push, con los dos interruptores (global y por usuario) y la regla de no enviar avisos tardíos | 15-16 |
| **M8** | QA, despliegue y lanzamiento | 10.2–10.4, 11 | `plan-de-pruebas.md` escrito y ejecutado; pruebas de integración y E2E en CI; staging y producción desplegados con Sentry; MVP con ≥100 conciertos cargados (meta del acta) | 17-19 |

### Correspondencia con el plan original

| Original | Ahora | Comentario |
|---|---|---|
| H1 (entorno base + CI) | parcialmente en M1 | Docker se hizo; CI nunca |
| H2 (modelo de datos + auth) | M2 + M3 | el modelo se hizo completo; auth quedó a medias |
| H3 (primer scraper + matching) | M4 | el matching se adelantó y está listo; el scraper no empezó |
| H4 (3 fuentes + scheduling) | M5 | ahora son 5 fuentes (se agregaron MusicBrainz y Setlist.fm) |
| H5 (CRUD conciertos) | absorbido por M2 | ya está casi completo |
| H6 (frontend de consulta) | ✅ hecho | fuera de orden respecto al plan original |
| H7 (likes, bookmarks, recordatorios) | M7 | sin cambio |
| H8-H9 (QA y despliegue) | M8 | sin cambio |
| — | M2 (moderación) | **no tenía hito propio en el plan original**; es el bloqueante del MVP |

### Hallazgo de M1: el constraint de choque de horario nunca existió

Al agregar al CI el paso que aplica `manual-constraints.sql` sobre la base migrada, falló:

```
ERROR: functions in index expression must be marked IMMUTABLE
```

Causa: Prisma traduce `DateTime` a `timestamp` **sin zona horaria**, mientras que el diseño (decisión 11 del documento de base de datos y todo `Schema SQL.md`) especifica `timestamptz`. Sobre columnas sin zona, `tstzrange(start_time, end_time)` necesita un cast que depende de la variable `TimeZone` de la sesión, y Postgres se niega a indexarlo.

Consecuencia: **el `EXCLUDE` de solapamiento no existía en ninguna base creada desde este repo**, y `PrismaExceptionFilter` traducía un error que nunca podía ocurrir. La regla de negocio más citada del proyecto no estaba aplicada en ningún lado.

Corregido en la migración `20260907120000_timestamptz_en_marcas_de_tiempo` (41 columnas). Verificado de punta a punta contra un Postgres real: migración desde cero → `manual-constraints.sql` sin errores → dos bandas solapadas en el mismo escenario → el `INSERT` se rechaza con el nombre de constraint que el filtro busca.

Lección para los hitos siguientes: los constraints que Prisma no expresa no los cubre ninguna prueba de aplicación. El paso de `manual-constraints.sql` en el CI es lo único que los vigila; no lo quites de `ci-api.yml`.

### Riesgo nuevo

Al riesgo R3 del acta (falsos positivos en el matching) se suma uno de proceso: **el diseño se está escribiendo dentro del código**. Tres documentos referenciados no existen y sus decisiones se están tomando implícitamente al implementar. M3 y M6 incluyen por eso escribir el documento *antes* de implementar, no después.
