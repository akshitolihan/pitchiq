"""
GET /api/matches/{id}   — single match with full prediction + driver breakdown.

Tier gating (server-side):
  Free  → basic W/D/L probs only, no confidence badge, no driver breakdown
  Paid  → full prediction including confidence + drivers
  Pro   → same as Paid (advanced features later milestones)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from api.database import get_db
from api.models.match import Match

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.get("/{match_id}")
def get_match(match_id: int, request: Request, db: Session = Depends(get_db)):
    tier = getattr(request.state, "tier", "free")

    match = (
        db.query(Match)
        .options(
            joinedload(Match.home_team),
            joinedload(Match.away_team),
            joinedload(Match.prediction),
        )
        .filter(Match.id == match_id)
        .first()
    )
    if not match:
        raise HTTPException(status_code=404, detail="Match not found.")

    pred = match.prediction

    result = {
        "id": match.id,
        "home_team": {
            "id": match.home_team.id,
            "name": match.home_team.name,
            "attack_strength": match.home_team.attack_strength,
            "defense_strength": match.home_team.defense_strength,
            "current_elo": match.home_team.current_elo,
        },
        "away_team": {
            "id": match.away_team.id,
            "name": match.away_team.name,
            "attack_strength": match.away_team.attack_strength,
            "defense_strength": match.away_team.defense_strength,
            "current_elo": match.away_team.current_elo,
        },
        "kickoff_utc": match.kickoff_utc.isoformat(),
        "status": match.status,
        "result": {
            "home_goals": match.home_goals,
            "away_goals": match.away_goals,
        } if match.status == "finished" else None,
        "disclaimer": (
            "These are model-derived probability estimates. "
            "Football is inherently uncertain — single matches are high variance. "
            "This is analysis only. You decide what to do with it."
        ),
    }

    if pred is None:
        result["prediction"] = None
        return result

    # Basic probs available to all tiers
    result["prediction"] = {
        "p_home_win": pred.p_home_win,
        "p_draw": pred.p_draw,
        "p_away_win": pred.p_away_win,
        "p_over_2_5": pred.p_over_2_5,
        "p_under_2_5": pred.p_under_2_5,
        "p_btts": pred.p_btts,
        "lambda_home": pred.lambda_home,
        "lambda_away": pred.lambda_away,
        "model_version": pred.model_version,
        "generated_at": pred.generated_at.isoformat() if pred.generated_at else None,
        # Paid+ only fields
        "confidence": pred.confidence if tier in ("paid", "pro") else None,
        "top_correct_scores": pred.top_correct_scores if tier in ("paid", "pro") else None,
        "drivers": pred.drivers if tier in ("paid", "pro") else None,
        "elo_home_win_prob": pred.elo_home_win_prob if tier in ("paid", "pro") else None,
        "tier_gate": None if tier in ("paid", "pro") else (
            "Confidence rating, driver breakdown and correct-score analysis "
            "are available on the Paid plan."
        ),
    }

    return result
