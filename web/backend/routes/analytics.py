import json
from collections import Counter
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Brain, DailyBrainStats, Run, User

router = APIRouter()

_IN = 3.0
_OUT = 15.0


def _get_brain(db: Session, slug: str, user: User) -> Brain:
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    return brain


@router.get("/api/brains/{slug}/analytics")
def get_brain_analytics(
    slug: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)

    # Recent runs for timeline + outcome + citation analysis
    recent_runs = (
        db.query(Run)
        .filter(Run.brain_id == brain.id, Run.user_id == user.id)
        .order_by(Run.created_at.desc())
        .limit(100)
        .all()
    )

    # Rule citation frequency
    rule_counter: Counter = Counter()
    for run in recent_runs:
        try:
            rules = json.loads(run.cited_rules or "[]")
            for rule in rules:
                rule_counter[rule[:80]] += 1
        except Exception:
            pass
    top_rules = [{"rule": r, "count": c} for r, c in rule_counter.most_common(10)]

    # Outcome counts
    outcome_counts = {
        "completed": sum(1 for r in recent_runs if r.status == "completed"),
        "failed": sum(1 for r in recent_runs if r.status == "failed"),
        "awaiting_approval": sum(1 for r in recent_runs if r.status == "awaiting_approval"),
        "running": sum(1 for r in recent_runs if r.status in ("pending", "queued", "running")),
    }

    # Timeline: last 14 days
    cutoff = datetime.utcnow() - timedelta(days=14)
    timeline = []
    for r in recent_runs:
        if not r.created_at or r.created_at < cutoff:
            continue
        verdict = r.review.verdict if r.review else None
        timeline.append({
            "id": r.id,
            "status": r.status,
            "verdict": verdict,
            "created_at": r.created_at.isoformat(),
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "cost_usd": round(
                (r.tokens_in / 1_000_000) * _IN + (r.tokens_out / 1_000_000) * _OUT, 6
            ),
        })

    # Heatmap: 12 weeks = 84 days from DailyBrainStats
    today = datetime.utcnow().date()
    date_84 = [(today - timedelta(days=i)).isoformat() for i in range(83, -1, -1)]
    eighty_four_days_ago = date_84[0]

    heatmap_rows = (
        db.query(DailyBrainStats)
        .filter(
            DailyBrainStats.brain_id == brain.id,
            DailyBrainStats.date >= eighty_four_days_ago,
        )
        .all()
    )
    heatmap_by_date = {row.date: row.runs_total for row in heatmap_rows}
    heatmap = [{"date": d, "count": heatmap_by_date.get(d, 0)} for d in date_84]

    return {
        "top_rules": top_rules,
        "outcome_counts": outcome_counts,
        "timeline": timeline,
        "heatmap": heatmap,
        "total_analyzed": len(recent_runs),
    }
