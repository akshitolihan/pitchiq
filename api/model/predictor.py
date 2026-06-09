"""
Orchestrates model fitting and prediction generation.

For each upcoming fixture, runs Dixon-Coles to produce a ScorelineMatrix,
computes a confidence level + explainability drivers, then writes a
Prediction row to the database.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from api.model.dixon_coles import DixonColesModel, MatchRecord
from api.model.elo import EloState, build_elo_from_history, elo_win_probability
from api.models.match import Match
from api.models.prediction import Prediction
from api.models.team import Team
from api.config import settings


# ------------------------------------------------------------------ #
# Confidence from entropy
# ------------------------------------------------------------------ #

def _shannon_entropy(probs: list[float]) -> float:
    """Shannon entropy of a probability distribution."""
    return -sum(p * math.log(p) for p in probs if p > 0)


def _confidence_level(p_home: float, p_draw: float, p_away: float, n_matches: int) -> str:
    """
    Derive High / Medium / Low confidence badge.

    - Entropy of W/D/L distribution: low entropy = one outcome dominates = higher confidence
    - Data completeness: fewer than 10 matches per team in training = lower confidence
    """
    probs = [p_home, p_draw, p_away]
    h = _shannon_entropy(probs)
    max_h = math.log(3)
    norm_entropy = h / max_h  # 0 = certain, 1 = uniform

    completeness = min(n_matches / 20.0, 1.0)  # 20+ matches = full score

    score = (1.0 - norm_entropy) * 0.7 + completeness * 0.3

    if score >= 0.55:
        return "High"
    if score >= 0.32:
        return "Medium"
    return "Low"


# ------------------------------------------------------------------ #
# Driver breakdown
# ------------------------------------------------------------------ #

def _build_drivers(
    home_team: str,
    away_team: str,
    dc: DixonColesModel,
    elo_state: EloState,
    n_matches: int,
) -> dict:
    """
    Return an explainability dict shown in the UI.
    Each driver has: label, value (signed float), description.
    """
    home_params = dc.team_params(home_team)
    away_params = dc.team_params(away_team)

    attack_edge = round(
        home_params.get("attack_strength", 0) - away_params.get("attack_strength", 0), 3
    )
    defense_edge = round(
        away_params.get("defense_strength", 0) - home_params.get("defense_strength", 0), 3
    )

    home_elo = elo_state.get(home_team)
    away_elo = elo_state.get(away_team)
    elo_edge = round((home_elo - away_elo) / 400.0, 3)  # normalised

    return {
        "team_strength": {
            "label": "Team strength (attack edge)",
            "value": attack_edge,
            "description": (
                f"{home_team} attack vs {away_team} defense: "
                f"{'home side has the edge' if attack_edge > 0 else 'away side has the edge'}. "
                f"Based on season-long Dixon-Coles fit."
            ),
            "positive_favours": "home" if attack_edge >= 0 else "away",
        },
        "defensive_solidity": {
            "label": "Defensive edge",
            "value": defense_edge,
            "description": (
                f"Defense comparison: "
                f"{'home side concedes less' if defense_edge > 0 else 'away side concedes less'}."
            ),
            "positive_favours": "home" if defense_edge >= 0 else "away",
        },
        "home_advantage": {
            "label": "Home advantage",
            "value": round(dc._gamma, 3),
            "description": (
                f"League home-advantage parameter γ={dc._gamma:.3f}. "
                "Adds to the home side's expected goals."
            ),
            "positive_favours": "home",
        },
        "elo_cross_check": {
            "label": "Elo cross-check",
            "value": elo_edge,
            "description": (
                f"Elo ratings — {home_team}: {int(home_elo)}, {away_team}: {int(away_elo)}. "
                f"{'Consistent with model.' if abs(elo_edge) < 0.5 else 'Notable Elo gap — treat with care.'}"
            ),
            "positive_favours": "home" if elo_edge >= 0 else "away",
        },
        "data_completeness": {
            "label": "Data completeness",
            "value": round(min(n_matches / 20.0, 1.0), 2),
            "description": (
                f"Model trained on {n_matches} matches. "
                f"{'Sufficient data.' if n_matches >= 10 else 'Limited data — treat probabilities with care.'}"
            ),
            "positive_favours": "neutral",
        },
    }


# ------------------------------------------------------------------ #
# Main entry points
# ------------------------------------------------------------------ #

def fit_model(db: Session) -> tuple[DixonColesModel, EloState]:
    """
    Load all finished matches from DB, fit Dixon-Coles + Elo, and
    store updated attack/defense/elo params back on Team rows.
    Returns the fitted model and Elo state.
    """
    finished = (
        db.query(Match)
        .filter(Match.status == "finished")
        .all()
    )

    if not finished:
        raise ValueError("No finished matches in DB — run seed first.")

    records = [
        MatchRecord(
            home_team=m.home_team.name,
            away_team=m.away_team.name,
            home_goals=m.home_goals,
            away_goals=m.away_goals,
            date=m.kickoff_utc,
        )
        for m in finished
        if m.home_goals is not None and m.away_goals is not None
    ]

    dc = DixonColesModel(xi=settings.time_decay_xi)
    dc.fit(records)

    elo_hist = [
        {"home": m.home_team.name, "away": m.away_team.name, "hg": m.home_goals, "ag": m.away_goals, "date": m.kickoff_utc}
        for m in finished
        if m.home_goals is not None
    ]
    elo_state = build_elo_from_history(elo_hist)

    # Persist params to Team rows
    now = datetime.now(timezone.utc)
    for team_name in dc.teams:
        team = db.query(Team).filter(Team.name == team_name).first()
        if team:
            p = dc.team_params(team_name)
            team.attack_strength = p.get("attack_strength")
            team.defense_strength = p.get("defense_strength")
            team.current_elo = round(elo_state.get(team_name), 1)
            team.last_rating_update = now
    db.commit()

    return dc, elo_state


def generate_predictions(db: Session, dc: DixonColesModel, elo_state: EloState) -> int:
    """
    For every scheduled match whose both teams are in the fitted model,
    upsert a Prediction row. Returns count of predictions written.
    """
    upcoming = (
        db.query(Match)
        .filter(Match.status == "scheduled")
        .all()
    )

    count = 0
    for match in upcoming:
        home = match.home_team.name
        away = match.away_team.name
        if home not in dc.teams or away not in dc.teams:
            continue

        sm = dc.predict(home, away)
        confidence = _confidence_level(sm.p_home_win, sm.p_draw, sm.p_away_win, dc.n_matches_used)
        drivers = _build_drivers(home, away, dc, elo_state, dc.n_matches_used)
        elo_probs = elo_win_probability(elo_state.get(home), elo_state.get(away))

        existing = db.query(Prediction).filter(Prediction.match_id == match.id).first()
        if existing:
            pred = existing
        else:
            pred = Prediction(match_id=match.id)
            db.add(pred)

        pred.generated_at = datetime.now(timezone.utc)
        pred.lambda_home = sm.lambda_home
        pred.lambda_away = sm.lambda_away
        pred.p_home_win = sm.p_home_win
        pred.p_draw = sm.p_draw
        pred.p_away_win = sm.p_away_win
        pred.p_over_2_5 = sm.p_over_2_5
        pred.p_under_2_5 = sm.p_under_2_5
        pred.p_btts = sm.p_btts
        pred.top_correct_scores = sm.top_correct_scores
        pred.confidence = confidence
        pred.drivers = drivers
        pred.elo_home_win_prob = elo_probs["home_win"]

        count += 1

    db.commit()
    return count
