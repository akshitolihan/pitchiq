"""
GET /api/fixtures   — list upcoming scheduled matches.

Tier gating (server-side):
  Free  → up to FREE_FIXTURE_LIMIT matches, no prediction detail
  Paid  → all upcoming matches, full prediction
  Pro   → same as Paid (extra features in later milestones)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session, joinedload

from api.database import get_db
from api.middleware.tier_gate import FREE_FIXTURE_LIMIT
from api.models.match import Match
from api.models.prediction import Prediction

router = APIRouter(prefix="/api/fixtures", tags=["fixtures"])


def _fmt_match(match: Match, include_prediction: bool, tier: str) -> dict:
    pred = match.prediction
    base = {
        "id": match.id,
        "home_team": match.home_team.name,
        "away_team": match.away_team.name,
        "kickoff_utc": match.kickoff_utc.isoformat(),
        "status": match.status,
        "tier_required": "free",
    }

    if not include_prediction or pred is None:
        base["prediction"] = None
        return base

    base["prediction"] = {
        "p_home_win": pred.p_home_win,
        "p_draw": pred.p_draw,
        "p_away_win": pred.p_away_win,
        "p_over_2_5": pred.p_over_2_5,
        "p_under_2_5": pred.p_under_2_5,
        "p_btts": pred.p_btts,
        "confidence": pred.confidence,
        # Drivers only on detail endpoint — keep list slim
    }
    return base


@router.get("")
def list_fixtures(
    request: Request,
    db: Session = Depends(get_db),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
):
    tier = getattr(request.state, "tier", "free")
    now = datetime.now(timezone.utc)

    q = (
        db.query(Match)
        .options(joinedload(Match.home_team), joinedload(Match.away_team), joinedload(Match.prediction))
        .filter(Match.status == "scheduled", Match.kickoff_utc >= now)
        .order_by(Match.kickoff_utc)
    )

    total = q.count()

    # Free tier: first FREE_FIXTURE_LIMIT fixtures only
    if tier == "free":
        matches = q.limit(FREE_FIXTURE_LIMIT).all()
        include_pred = False
        gated_message = (
            f"Free tier shows {FREE_FIXTURE_LIMIT} upcoming fixtures. "
            "Upgrade to Paid to see all fixtures and full model analysis."
        )
    else:
        matches = q.offset(offset).limit(limit).all()
        include_pred = True
        gated_message = None

    items = [_fmt_match(m, include_pred, tier) for m in matches]

    return {
        "tier": tier,
        "total_available": total,
        "shown": len(items),
        "gated_message": gated_message,
        "items": items,
        "disclaimer": (
            "Probabilities are model estimates — not guarantees. "
            "This is analysis. You decide."
        ),
    }
