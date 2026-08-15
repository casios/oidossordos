-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('usuario', 'moderador', 'administrador');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('pendiente', 'aprobado', 'rechazado');

-- CreateEnum
CREATE TYPE "ContentSourceType" AS ENUM ('etl', 'manual');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('concierto', 'festival');

-- CreateEnum
CREATE TYPE "ExternalSource" AS ENUM ('metal_archives', 'metal_storm', 'bandsintown', 'musicbrainz', 'setlist_fm');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('email', 'push');

-- CreateEnum
CREATE TYPE "ModerationEntityType" AS ENUM ('band', 'venue', 'event');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('aprobado', 'rechazado', 'cambios_solicitados');

-- CreateEnum
CREATE TYPE "EtlRunStatus" AS ENUM ('success', 'failed', 'partial');

-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('email_verification', 'password_reset');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT,
    "oauth_provider" TEXT,
    "oauth_id" TEXT,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'usuario',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notifications_paused_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "replaced_by" TEXT,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh_key" TEXT NOT NULL,
    "auth_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT,
    "formed_year" INTEGER,
    "bio" TEXT,
    "is_tribute" BOOLEAN NOT NULL DEFAULT false,
    "tribute_of_band_id" TEXT,
    "source_type" "ContentSourceType" NOT NULL DEFAULT 'manual',
    "status" "ModerationStatus" NOT NULL DEFAULT 'pendiente',
    "created_by" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "band_external_ids" (
    "id" TEXT NOT NULL,
    "band_id" TEXT NOT NULL,
    "source" "ExternalSource" NOT NULL,
    "external_id" TEXT NOT NULL,
    "url" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "band_external_ids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "band_genres" (
    "band_id" TEXT NOT NULL,
    "genre_id" INTEGER NOT NULL,

    CONSTRAINT "band_genres_pkey" PRIMARY KEY ("band_id","genre_id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "state_region" TEXT,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "capacity" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "source_type" "ContentSourceType" NOT NULL DEFAULT 'manual',
    "status" "ModerationStatus" NOT NULL DEFAULT 'pendiente',
    "created_by" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "capacity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "EventType" NOT NULL DEFAULT 'concierto',
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "venue_id" TEXT NOT NULL,
    "source_type" "ContentSourceType" NOT NULL DEFAULT 'manual',
    "status" "ModerationStatus" NOT NULL DEFAULT 'pendiente',
    "created_by" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_external_ids" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source" "ExternalSource" NOT NULL,
    "external_id" TEXT NOT NULL,
    "url" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_external_ids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_stages" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "display_name" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_bands" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "band_id" TEXT NOT NULL,
    "event_stage_id" TEXT,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "billing_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_info" (
    "event_id" TEXT NOT NULL,
    "price_min" DOUBLE PRECISION,
    "price_max" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "external_url" TEXT,
    "on_sale_date" DATE,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_info_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "likes" (
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("user_id","event_id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("user_id","event_id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "remind_before" TEXT NOT NULL DEFAULT '1 day',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_log" (
    "id" TEXT NOT NULL,
    "entity_type" "ModerationEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "reason" TEXT,
    "reviewer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etl_runs" (
    "id" TEXT NOT NULL,
    "source" "ExternalSource" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" "EtlRunStatus",
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_created" INTEGER NOT NULL DEFAULT 0,
    "records_matched" INTEGER NOT NULL DEFAULT 0,
    "error_log" TEXT,

    CONSTRAINT "etl_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_oauth_provider_oauth_id_key" ON "users"("oauth_provider", "oauth_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "genres_name_key" ON "genres"("name");

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "band_external_ids_source_external_id_key" ON "band_external_ids"("source", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "stages_venue_id_name_key" ON "stages"("venue_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "event_external_ids_source_external_id_key" ON "event_external_ids"("source", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_stages_event_id_stage_id_key" ON "event_stages"("event_id", "stage_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminders_user_id_event_id_channel_remind_before_key" ON "reminders"("user_id", "event_id", "channel", "remind_before");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bands" ADD CONSTRAINT "bands_tribute_of_band_id_fkey" FOREIGN KEY ("tribute_of_band_id") REFERENCES "bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bands" ADD CONSTRAINT "bands_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bands" ADD CONSTRAINT "bands_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "band_external_ids" ADD CONSTRAINT "band_external_ids_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "band_genres" ADD CONSTRAINT "band_genres_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "band_genres" ADD CONSTRAINT "band_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_external_ids" ADD CONSTRAINT "event_external_ids_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_stages" ADD CONSTRAINT "event_stages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_stages" ADD CONSTRAINT "event_stages_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bands" ADD CONSTRAINT "event_bands_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bands" ADD CONSTRAINT "event_bands_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bands" ADD CONSTRAINT "event_bands_event_stage_id_fkey" FOREIGN KEY ("event_stage_id") REFERENCES "event_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_info" ADD CONSTRAINT "ticket_info_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
