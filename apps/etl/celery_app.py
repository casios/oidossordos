# apps/etl/celery_app.py
# Ver `docs/Diseño del Módulo ETL.md` sección 5.1 — horarios escalonados por fuente.
# OJO: el paquete `tasks/` está vacío; estas cinco tareas todavía no existen.
import os

from celery import Celery
from celery.schedules import crontab

celery_app = Celery(
    "agenda_metal_etl",
    broker=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
)

celery_app.conf.beat_schedule = {
    "bandsintown-every-6h": {
        "task": "tasks.bandsintown.run",
        "schedule": crontab(minute=0, hour="*/6"),
    },
    "setlistfm-daily": {
        "task": "tasks.setlist_fm.run",
        "schedule": crontab(minute=0, hour=3),
    },
    "metal-archives-daily": {
        "task": "tasks.metal_archives.run",
        "schedule": crontab(minute=0, hour=4),
    },
    "metal-storm-daily": {
        "task": "tasks.metal_storm.run",
        "schedule": crontab(minute=30, hour=4),
    },
    "reminders-every-5min": {
        "task": "tasks.reminders.dispatch",
        "schedule": crontab(minute="*/5"),
    },
}

celery_app.conf.timezone = "UTC"
