-- =========================================================
-- Agenda Metal Colaborativa — Esquema de Base de Datos
-- PostgreSQL 15+
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ---------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------

CREATE TYPE user_role AS ENUM ('usuario', 'moderador', 'administrador');
CREATE TYPE moderation_status AS ENUM ('pendiente', 'aprobado', 'rechazado');
CREATE TYPE content_source_type AS ENUM ('etl', 'manual');
CREATE TYPE event_type AS ENUM ('concierto', 'festival');
CREATE TYPE external_source AS ENUM ('metal_archives', 'metal_storm', 'bandsintown');
CREATE TYPE reminder_channel AS ENUM ('email', 'push');
CREATE TYPE moderation_entity_type AS ENUM ('band', 'venue', 'event');
CREATE TYPE moderation_action AS ENUM ('aprobado', 'rechazado', 'cambios_solicitados');
CREATE TYPE etl_run_status AS ENUM ('success', 'failed', 'partial');

-- ---------------------------------------------------------
-- USERS
-- ---------------------------------------------------------

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           CITEXT UNIQUE NOT NULL,
    password_hash   TEXT,                       -- NULL si el usuario solo usa OAuth
    oauth_provider  TEXT,                        -- 'google', 'discord', NULL
    oauth_id        TEXT,
    display_name    TEXT NOT NULL,
    avatar_url      TEXT,
    role            user_role NOT NULL DEFAULT 'usuario',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (oauth_provider, oauth_id)
);

-- Nota: el campo email usa CITEXT (extensión ya creada arriba) para comparación
-- case-insensitive nativa. Si se prefiere evitar la extensión, usar TEXT +
-- índice único funcional: CREATE UNIQUE INDEX ON users (lower(email));

-- ---------------------------------------------------------
-- GENRES
-- ---------------------------------------------------------

CREATE TABLE genres (
    id      SERIAL PRIMARY KEY,
    name    TEXT UNIQUE NOT NULL,
    slug    TEXT UNIQUE NOT NULL
);

-- ---------------------------------------------------------
-- BANDS
-- ---------------------------------------------------------

CREATE TABLE bands (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    country         CHAR(2),                    -- ISO 3166-1 alpha-2
    formed_year     SMALLINT,
    bio             TEXT,
    source_type     content_source_type NOT NULL DEFAULT 'manual',
    status          moderation_status NOT NULL DEFAULT 'pendiente',
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,                 -- soft delete: NULL = activa
    deleted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Slug único solo entre registros activos: permite reutilizar el slug
-- si el original fue borrado (soft-deleted).
CREATE UNIQUE INDEX idx_bands_slug_active ON bands(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_bands_status ON bands(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_bands_name_trgm ON bands USING GIN (name gin_trgm_ops);

CREATE TABLE band_external_ids (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    band_id         UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
    source          external_source NOT NULL,
    external_id     TEXT NOT NULL,
    url             TEXT,
    last_synced_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source, external_id)
);

CREATE INDEX idx_band_external_ids_band ON band_external_ids(band_id);

CREATE TABLE band_genres (
    band_id     UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
    genre_id    INT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (band_id, genre_id)
);

-- ---------------------------------------------------------
-- VENUES
-- ---------------------------------------------------------

CREATE TABLE venues (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    address         TEXT,
    city            TEXT NOT NULL,
    state_region    TEXT,
    country         CHAR(2) NOT NULL,
    latitude        NUMERIC(9,6),
    longitude       NUMERIC(9,6),
    capacity        INT,
    timezone        TEXT NOT NULL DEFAULT 'UTC',   -- IANA tz, ej. 'America/Mexico_City'
    source_type     content_source_type NOT NULL DEFAULT 'manual',
    status          moderation_status NOT NULL DEFAULT 'pendiente',
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,
    deleted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_venues_slug_active ON venues(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_city ON venues(city) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_status ON venues(status) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------
-- EVENTS (conciertos / festivales)
-- ---------------------------------------------------------

CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    type            event_type NOT NULL DEFAULT 'concierto',
    description     TEXT,
    start_date      DATE NOT NULL,
    end_date        DATE,                          -- NULL o = start_date si es de un solo día
    venue_id        UUID NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
    source_type     content_source_type NOT NULL DEFAULT 'manual',
    status          moderation_status NOT NULL DEFAULT 'pendiente',
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,
    deleted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_event_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX idx_events_slug_active ON events(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_start_date ON events(start_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_status ON events(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_venue ON events(venue_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_name_trgm ON events USING GIN (name gin_trgm_ops);

CREATE TABLE event_external_ids (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    source          external_source NOT NULL,
    external_id     TEXT NOT NULL,
    url             TEXT,
    last_synced_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source, external_id)
);

-- Escenario físico, ligado al venue. Persiste entre ediciones del evento
-- (ej. el "escenario principal" de un venue no cambia, aunque cambie de patrocinador).
CREATE TABLE stages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id        UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,              -- nombre físico/canónico, ej. "Escenario Principal"
    latitude        NUMERIC(9,6),
    longitude       NUMERIC(9,6),
    capacity        INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (venue_id, name)
);

-- Qué escenarios activa una edición concreta del evento, con nombre de
-- patrocinador (si aplica) y orden de columna para la grilla del timetable.
CREATE TABLE event_stages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    stage_id        UUID NOT NULL REFERENCES stages(id) ON DELETE RESTRICT,
    display_name    TEXT,                       -- override por patrocinio, ej. "Jägermeister Stage"
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, stage_id)
);

CREATE INDEX idx_event_stages_event ON event_stages(event_id);

-- Line-up: banda + escenario-de-evento + horario
CREATE TABLE event_bands (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    band_id         UUID NOT NULL REFERENCES bands(id) ON DELETE RESTRICT,
    event_stage_id  UUID REFERENCES event_stages(id) ON DELETE SET NULL,  -- NULL si el evento tiene un solo escenario
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    billing_order   SMALLINT,                      -- 1 = headliner, orden de cartel
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, band_id, event_stage_id, start_time)
);

CREATE INDEX idx_event_bands_event ON event_bands(event_id);
CREATE INDEX idx_event_bands_band ON event_bands(band_id);

-- Evita que dos bandas queden agendadas al mismo tiempo en el mismo escenario
-- (choque de horario real, imposible en un festival físico).
CREATE EXTENSION IF NOT EXISTS "btree_gist";

ALTER TABLE event_bands ADD CONSTRAINT excl_stage_time_overlap
    EXCLUDE USING GIST (
        event_stage_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    )
    WHERE (event_stage_id IS NOT NULL AND start_time IS NOT NULL AND end_time IS NOT NULL);

-- Información de boletos (1:1 con events)
CREATE TABLE ticket_info (
    event_id        UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    price_min       NUMERIC(10,2),
    price_max       NUMERIC(10,2),
    currency        CHAR(3) NOT NULL DEFAULT 'MXN',
    external_url    TEXT,
    on_sale_date    DATE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- INTERACCIÓN SOCIAL
-- ---------------------------------------------------------

CREATE TABLE likes (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, event_id)
);

CREATE INDEX idx_likes_event ON likes(event_id);

CREATE TABLE bookmarks (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, event_id)
);

CREATE INDEX idx_bookmarks_event ON bookmarks(event_id);

-- ---------------------------------------------------------
-- RECORDATORIOS
-- ---------------------------------------------------------

CREATE TABLE reminders (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    channel             reminder_channel NOT NULL,
    remind_before       INTERVAL NOT NULL DEFAULT '1 day',
    sent_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, event_id, channel, remind_before)
);

CREATE INDEX idx_reminders_pending ON reminders(event_id) WHERE sent_at IS NULL;

-- ---------------------------------------------------------
-- MODERACIÓN (auditoría)
-- ---------------------------------------------------------

CREATE TABLE moderation_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type     moderation_entity_type NOT NULL,
    entity_id       UUID NOT NULL,                 -- referencia lógica a bands/venues/events.id
    action          moderation_action NOT NULL,
    reason          TEXT,
    reviewer_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_moderation_log_entity ON moderation_log(entity_type, entity_id);

-- ---------------------------------------------------------
-- ETL / SCRAPING (trazabilidad)
-- ---------------------------------------------------------

CREATE TABLE etl_runs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source              external_source NOT NULL,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at         TIMESTAMPTZ,
    status              etl_run_status,
    records_processed   INT NOT NULL DEFAULT 0,
    records_created     INT NOT NULL DEFAULT 0,
    records_matched     INT NOT NULL DEFAULT 0,
    error_log           TEXT
);

CREATE INDEX idx_etl_runs_source ON etl_runs(source, started_at DESC);

-- ---------------------------------------------------------
-- TRIGGER genérico para updated_at
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bands_updated_at BEFORE UPDATE ON bands
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_venues_updated_at BEFORE UPDATE ON venues
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();