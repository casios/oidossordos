# Diseño del Módulo ETL — Scraping y Homologación de Bandas/Eventos

Cubre RF-03 a RF-06. Implementado como servicio Python separado del backend principal (NestJS), con Celery + Redis como orquestador de tareas.

---

## 1. Estrategia de extracción por fuente

|Fuente|Método de acceso|Notas|
|---|---|---|
|**Bandsintown**|API REST oficial (`rest.bandsintown.com`)|Requiere `app_id` aprobado por Bandsintown (aceptación de términos + solicitud manual de acceso). Es la fuente más confiable: entrega JSON estructurado, sin necesidad de parsear HTML ni renderizar JS.|
|**MusicBrainz**|API REST/XML oficial (`musicbrainz.org/ws/2/`)|Sin aprobación previa; datos core bajo licencia CC0 (dominio público). Cada banda tiene un MBID único, con alias, país y fecha de formación/disolución. Se convierte en la **clave maestra de homologación** (ver sección 4): Bandsintown incluso permite buscar artistas directamente por MBID. Rate limit público bajo (1 req/seg recomendado), respetar cabecera `User-Agent` identificable requerida por su política de uso.|
|**Setlist.fm**|API REST oficial (requiere API key, aprobación rápida)|Fuerte en historial de shows pasados y setlists reales, útil para _validar_ que una banda/venue son activos y reales (señal de confianza adicional en el matching), no tanto para descubrir eventos futuros.|
|**Metal Archives**|Scraping HTML (Scrapy)|Sin API pública oficial. Requiere validar `robots.txt` y ToS vigentes antes de producción; se recomienda contactar formalmente a los administradores del sitio, igual que el proceso de aprobación de Bandsintown.|
|**Metal Storm**|Scraping HTML (Scrapy)|Mismo caso que Metal Archives: sin API oficial, validar términos antes de scrapear en producción.|

**Implicación de diseño**: los conectores de Bandsintown, MusicBrainz y Setlist.fm son clientes de API simples (requests + manejo de rate limits del proveedor). Los conectores de Metal Archives y Metal Storm son _spiders_ de Scrapy con parsers específicos por sitio — son los que requieren el circuito de resiliencia descrito en la sección 5, porque un cambio de maquetación en el sitio rompe el parser sin previo aviso (a diferencia de una API versionada).

---

## 2. Arquitectura del pipeline

```
┌──────────────┐   ┌───────────────┐   ┌──────────────────┐   ┌─────────┐   ┌────────────┐
│  Scheduler   │──▶│   Extractor   │──▶│    Normalizer     │──▶│ Matcher │──▶│   Loader   │
│ (Celery beat)│   │ (por fuente)  │   │ (esquema común)   │   │ (RF-04) │   │ (Postgres) │
└──────────────┘   └───────────────┘   └──────────────────┘   └─────────┘   └────────────┘
                            │                                       │              │
                            ▼                                       ▼              ▼
                     etl_runs (log)                          moderation_log   band_external_ids /
                                                              (si baja        event_external_ids
                                                              confianza)
```

Cada etapa es una tarea Celery encadenada (`chain()`), de forma que un fallo en `Extractor` no ejecuta `Normalizer`/`Matcher`/`Loader`, y cada etapa registra su resultado en `etl_runs`.

---

## 3. Esquema de normalización intermedio

Todas las fuentes convergen a esta representación antes de tocar la base de datos (evita que el Matcher/Loader conozcan detalles de cada fuente):

```json
{
  "source": "metal_archives",
  "external_id": "12345",
  "type": "band",
  "name": "Gojira",
  "country": "FR",
  "formed_year": 1996,
  "genres": ["Progressive Metal", "Death Metal"],
  "url": "https://www.metal-archives.com/bands/Gojira/12345",
  "mbid": "b6608331-b433-4b41-a99e-fb28546b9dc3",
  "raw_payload": { "...": "..." }
}
```

`mbid` se completa durante la etapa de matching (paso 0 de la sección 4), no en la extracción — se deja aquí como parte del esquema común porque es el campo que finalmente ata todas las fuentes entre sí.

Para eventos:

```json
{
  "source": "bandsintown",
  "external_id": "ev_98765",
  "type": "event",
  "name": null,
  "start_datetime": "2027-04-17T21:00:00-06:00",
  "venue": { "name": "Foro Sol", "city": "Ciudad de México", "country": "MX" },
  "bands": [{ "name": "Gojira", "source_artist_id": "art_555" }],
  "ticket_url": "https://www.bandsintown.com/t/...",
  "raw_payload": { "...": "..." }
}
```

`raw_payload` se conserva siempre (columna `jsonb` en `etl_runs` o en una tabla de staging) para poder reprocesar sin volver a golpear la fuente si el motor de matching cambia.

---

## 4. Motor de homologación (matching) — RF-04

Regla en cascada, de más a menos estricta:

0. **MusicBrainz ID (MBID) como clave maestra, cuando esté disponible**: si dos fuentes distintas (ej. Bandsintown y Metal Archives) resuelven a la misma banda en MusicBrainz, se homologan directamente por MBID sin pasar por fuzzy matching. En la práctica: al normalizar una banda de cualquier fuente, el pipeline intenta primero resolverla contra MusicBrainz (por nombre) para obtener su MBID; si lo logra, ese MBID se guarda como `external_id` con `source = musicbrainz` y sirve de ancla — cualquier otra fuente que también resuelva al mismo MBID se homologa con alta confianza automáticamente, aunque el nombre tenga variaciones menores.
1. **Coincidencia exacta por ID externo**: si `(source, external_id)` ya existe en `band_external_ids`/`event_external_ids` → actualizar (`last_synced_at`), no crear nada nuevo.
2. **Coincidencia determinística**: `name` normalizado (minúsculas, sin acentos, sin sufijos como "official") + `country`iguales a un registro existente en `bands` → vincular el nuevo `external_id` a esa banda.
3. **Coincidencia difusa (fuzzy)**: usando `rapidfuzz.fuzz.token_sort_ratio` sobre el nombre, con umbrales:
    - **≥ 92**: auto-match, se vincula automáticamente.
    - **75–91**: confianza media → se crea la relación pero la banda/evento queda en `moderation_log` con nota "posible duplicado de {band_id}" para revisión manual por un Moderador.
    - **< 75**: se trata como banda nueva (`status = pendiente` si `source_type = etl` no está configurado para auto-publicar).
4. **Setlist.fm como señal de confianza, no de identidad**: no se usa para resolver duplicados (no todas las bandas de metal under­ground tienen setlists documentados ahí), pero si una banda/venue aparece en Setlist.fm con shows recientes, esa señal se guarda (ej. columna o log auxiliar) y puede usarse para priorizar auto-publicación de contenido `etl` sobre bandas "verificadas" en más de una fuente externa.
5. **Registro de la decisión**: toda coincidencia (automática o manual) queda trazada — si es automática, en un log de matching (no necesariamente `moderation_log`, que es para contenido pendiente de aprobación humana); si requirió revisión, sí entra a `moderation_log`.

Para eventos, el mismo mecanismo aplica sobre `(venue.name + city, start_date)` cuando no hay `external_id` directo (ej. si Metal Archives lista un show sin ID propio de evento).

---

## 5. Scheduling y resiliencia

### 5.1 Scheduling

- Celery beat con una tarea por fuente, horarios escalonados para no golpear todo al mismo tiempo:
    - Bandsintown: cada 6 horas (API tolera más frecuencia).
    - MusicBrainz: bajo demanda, disparado por el propio pipeline cada vez que se normaliza una banda nueva de cualquier fuente (no es una corrida programada independiente, sino una consulta de resolución en tiempo real dentro del pipeline).
    - Setlist.fm: 1 vez al día, solo sobre bandas ya homologadas (para no gastar cuota de API en bandas que aún no existen en el catálogo).
    - Metal Archives / Metal Storm: 1 vez al día (scraping más pesado, se prioriza no generar carga).
- Cada ejecución crea una fila en `etl_runs` al iniciar (`status = null` hasta terminar) y la actualiza al finalizar (`success`/`failed`/`partial`).

### 5.2 Reintentos y backoff

- Uso de `tenacity` con backoff exponencial (ej. 3 reintentos, `2^n` segundos) para errores transitorios de red (timeout, 5xx).
- Errores 4xx (ej. 404 de una banda que ya no existe en la fuente) no se reintentan, se registran y se continúa con el siguiente ítem.

### 5.3 Circuit breaker por cambio de estructura

Los spiders de Metal Archives/Metal Storm validan, antes de parsear el resto de campos, que los selectores esperados existan en la página (ej. el contenedor de biografía). Si más de N páginas seguidas (configurable, ej. 5) fallan esa validación, el spider se detiene solo, marca la corrida como `failed` con `error_log = 'PARSING_STRUCTURE_CHANGED'`, y dispara una alerta (Sentry + email al equipo) — en vez de seguir corriendo y llenar la base de datos con registros vacíos o corruptos.

### 5.4 Idempotencia

- Inserciones vía `UPSERT` (`INSERT ... ON CONFLICT (source, external_id) DO UPDATE`) en `band_external_ids`/`event_external_ids`, de forma que correr el mismo scraping dos veces no duplica datos.
- El `raw_payload` se compara por hash contra la última corrida; si no cambió, se omite el reprocesamiento completo (solo se actualiza `last_synced_at`).

### 5.5 Buenas prácticas de scraping (Metal Archives / Metal Storm)

- Respetar `robots.txt` y cualquier `Crawl-delay` publicado.
- User-Agent identificable con datos de contacto (ej. `AgendaMetalBot/1.0 (+contacto@agendametal.app)`), no simular ser un navegador para "pasar desapercibido".
- Límite de concurrencia por dominio (ej. 1-2 requests simultáneas) y delay mínimo entre requests (ej. 2-3 segundos), configurable por fuente.
- Cachear páginas ya descargadas (por hash de URL) para no re-descargar contenido sin cambios en corridas frecuentes.

---

## 6. Observabilidad

- `etl_runs` (ya definido en el esquema) para métricas por corrida: procesados, creados, homologados, errores.
- Panel de administración (`GET /etl/runs`, ya definido en el diseño de API) para que el equipo vea el historial sin entrar a logs crudos.
- Alertas automáticas ante: corrida `failed`, tasa de coincidencias de baja confianza por encima de un umbral (podría indicar que el algoritmo de matching necesita ajuste), o 0 registros nuevos en una corrida que históricamente trae datos (señal de que algo se rompió silenciosamente).

---

## 7. Pendiente de decisión / seguimiento

- **Aprobación de Bandsintown**: gestionar la solicitud de `app_id` lo antes posible en el cronograma (Fase 0-1), ya que depende de un tercero y no es instantánea.
- **Registro de API key de Setlist.fm**: trámite más rápido que Bandsintown, pero sigue siendo una dependencia externa a resolver antes de la Fase 1.
- **Confirmación de ToS de Metal Archives/Metal Storm**: antes de mover el scraper de estas dos fuentes a producción, revisar sus términos vigentes (pueden haber cambiado desde el diseño de este documento) y decidir si se procede, se contacta a los administradores, o se limita el alcance a datos que la comunidad carga manualmente para esas dos fuentes específicas.
- **Cuota de MusicBrainz**: al usarse como resolución en tiempo real dentro del pipeline (no como corrida programada), conviene cachear agresivamente las resoluciones ya hechas (tabla `band_external_ids` ya cumple ese rol) para no re-consultar MusicBrainz por la misma banda en cada corrida de las otras fuentes.