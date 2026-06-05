from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Brain, DailyBrainStats, Escalation, Run, User

router = APIRouter()

_INPUT_COST_PER_M = 3.0
_OUTPUT_COST_PER_M = 15.0


def _get_brain(db: Session, slug: str, user: User) -> Brain:
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    return brain


@router.get("/api/brains/{slug}/activity")
def get_brain_activity(
    slug: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)

    today = datetime.utcnow().date()
    date_range = [(today - timedelta(days=i)).isoformat() for i in range(29, -1, -1)]

    rows = (
        db.query(DailyBrainStats)
        .filter(
            DailyBrainStats.brain_id == brain.id,
            DailyBrainStats.date >= date_range[0],
        )
        .all()
    )
    row_by_date = {r.date: r for r in rows}

    days = []
    for d in date_range:
        row = row_by_date.get(d)
        if row:
            days.append({
                "date": d,
                "runs_total": row.runs_total,
                "runs_auto_completed": row.runs_auto_completed,
                "runs_escalated": row.runs_escalated,
                "runs_failed": row.runs_failed,
                "cost_cents": row.cost_cents,
                "median_duration_ms": row.median_duration_ms,
            })
        else:
            days.append({
                "date": d,
                "runs_total": 0,
                "runs_auto_completed": 0,
                "runs_escalated": 0,
                "runs_failed": 0,
                "cost_cents": 0,
                "median_duration_ms": 0,
            })

    return {"brain_name": brain.name, "days": days}


@router.get("/api/workspace/dashboard")
def get_workspace_dashboard(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days_ago = (datetime.utcnow() - timedelta(days=6)).date().isoformat()

    brains = db.query(Brain).filter_by(owner_id=user.id).all()
    brain_ids = [b.id for b in brains]

    # Today's runs across all brains
    runs_today_all = (
        db.query(Run)
        .filter(Run.brain_id.in_(brain_ids), Run.created_at >= today_start)
        .all()
    ) if brain_ids else []
    total_cost_today = sum(
        (r.tokens_in / 1_000_000) * _INPUT_COST_PER_M +
        (r.tokens_out / 1_000_000) * _OUTPUT_COST_PER_M
        for r in runs_today_all
    )

    # Pending escalations across workspace (single query)
    pending_escs_total = 0
    pending_escs_by_brain: dict = defaultdict(int)
    if brain_ids:
        esc_rows = (
            db.query(Run.brain_id, Escalation.id)
            .join(Escalation, Escalation.run_id == Run.id)
            .filter(Run.brain_id.in_(brain_ids), Escalation.status == "pending")
            .all()
        )
        for b_id, _ in esc_rows:
            pending_escs_by_brain[b_id] += 1
        pending_escs_total = len(esc_rows)

    # Sparkline data (single query)
    sparkline_rows = (
        db.query(DailyBrainStats)
        .filter(
            DailyBrainStats.brain_id.in_(brain_ids),
            DailyBrainStats.date >= seven_days_ago,
        )
        .all()
    ) if brain_ids else []
    sparkline_lookup: dict = defaultdict(dict)
    for row in sparkline_rows:
        sparkline_lookup[row.brain_id][row.date] = row.runs_total

    date_7 = [(datetime.utcnow() - timedelta(days=i)).date().isoformat() for i in range(6, -1, -1)]

    # Group today's runs by brain
    today_by_brain: dict = defaultdict(list)
    for r in runs_today_all:
        today_by_brain[r.brain_id].append(r)

    brain_items = []
    for brain in brains:
        brain_runs = today_by_brain[brain.id]
        brain_items.append({
            "slug": brain.slug,
            "runs_today": len(brain_runs),
            "failed_today": sum(1 for r in brain_runs if r.status == "failed"),
            "pending_escalations": pending_escs_by_brain[brain.id],
            "sparkline": [sparkline_lookup[brain.id].get(d, 0) for d in date_7],
        })

    return {
        "total_brains": len(brains),
        "total_runs_today": len(runs_today_all),
        "pending_escalations": pending_escs_total,
        "total_cost_usd_today": round(total_cost_today, 6),
        "brains": brain_items,
    }
