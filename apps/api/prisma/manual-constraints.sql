-- apps/api/prisma/manual-constraints.sql
--
-- Prisma no expresa nativamente: EXCLUDE constraints, índices únicos parciales,
-- CITEXT, CHECK constraints complejos, ni índices GIN/trgm. Este archivo se
-- aplica a mano después de la primera migración de Prisma (`prisma migrate dev`),
-- agregándolo al archivo de migración generado o corriéndolo aparte.
--
-- Ver /docs/schema.sql para el DDL completo y comentado — esto es solo el
-- delta que Prisma no puede generar por sí solo.

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Slugs únicos solo entre registros activos (soft delete)
CREATE UNIQUE INDEX idx_bands_slug_active ON bands(slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_venues_slug_active ON venues(slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_events_slug_active ON events(slug) WHERE deleted_at IS NULL;

-- Búsqueda difusa (autocompletado, motor de matching del ETL)
CREATE INDEX idx_bands_name_trgm ON bands USING GIN (name gin_trgm_ops);
CREATE INDEX idx_events_name_trgm ON events USING GIN (name gin_trgm_ops);

-- Bandas tributo: no se puede referenciar una banda original sin marcarse
-- como tributo, y no se puede tributar a sí misma.
ALTER TABLE bands ADD CONSTRAINT chk_tribute_reference
  CHECK (tribute_of_band_id IS NULL OR is_tribute = TRUE);
ALTER TABLE bands ADD CONSTRAINT chk_tribute_not_self
  CHECK (tribute_of_band_id IS NULL OR tribute_of_band_id <> id);

-- Fecha de fin de evento no puede ser anterior a la de inicio
ALTER TABLE events ADD CONSTRAINT chk_event_dates
  CHECK (end_date IS NULL OR end_date >= start_date);

-- El constraint central del proyecto: impide que dos bandas queden agendadas
-- al mismo tiempo en el mismo escenario. Ver diseno-base-de-datos.md sección 5.
ALTER TABLE event_bands ADD CONSTRAINT excl_stage_time_overlap
  EXCLUDE USING GIST (
    event_stage_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
  WHERE (event_stage_id IS NOT NULL AND start_time IS NOT NULL AND end_time IS NOT NULL);

-- Mapeo del error de este constraint a 409 SCHEDULE_CONFLICT: ver
-- apps/api/src/common/filters/prisma-exception.filter.ts — intercepta el
-- código de error de Postgres (23P01, exclusion_violation) y lo traduce.
