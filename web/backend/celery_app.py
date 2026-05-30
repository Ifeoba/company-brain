from celery import Celery
from .config import settings

celery_app = Celery(
    "company_brain",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["backend.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # Late acks: the task won't be removed from the queue until it finishes.
    # This ensures runs survive worker restarts.
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_default_queue="runs",
    task_routes={
        "backend.tasks.execute_run_task": {"queue": "runs"},
        "backend.tasks.check_scheduled_triggers": {"queue": "runs"},
        "backend.tasks.run_maintainer_for_brain": {"queue": "maintainer"},
        "backend.tasks.run_maintainer_for_all": {"queue": "maintainer"},
    },
    beat_schedule={
        "check-schedules": {
            "task": "backend.tasks.check_scheduled_triggers",
            "schedule": 60.0,  # every minute
        },
        "maintainer-daily": {
            "task": "backend.tasks.run_maintainer_for_all",
            "schedule": 86400.0,
        },
    },
)
