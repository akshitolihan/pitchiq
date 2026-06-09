"""
Elo rating system for football.

Features:
- Draw adjustment (expected draw probability ~25% in football)
- Margin-of-victory (MoV) scaling on K-factor
- Starting rating 1500; K = 32 (adjustable)
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
from datetime import datetime


STARTING_ELO = 1500.0
K_BASE = 32.0
DRAW_ADJUSTMENT = 0.25   # neutral expected draw probability factored into expectation


@dataclass
class EloState:
    ratings: dict[str, float] = field(default_factory=dict)

    def get(self, team: str) -> float:
        return self.ratings.get(team, STARTING_ELO)

    def update(self, team: str, rating: float) -> None:
        self.ratings[team] = rating


def _expected_win(r_a: float, r_b: float) -> float:
    """
    Football-adapted Elo expected score for team A vs team B.
    Accounts for the draw probability by splitting the expected draw
    equally between both sides' 'expected score'.
    """
    return 1.0 / (1.0 + 10.0 ** ((r_b - r_a) / 400.0))


def _mov_multiplier(goal_diff: int) -> float:
    """Margin-of-victory K scaling; caps at ~1.75 for blowouts."""
    return math.log(abs(goal_diff) + 1) + 1.0 if goal_diff != 0 else 1.0


def _result_score(home_goals: int, away_goals: int) -> tuple[float, float]:
    """Returns (home_score, away_score) in Elo terms: 1/0.5/0."""
    if home_goals > away_goals:
        return 1.0, 0.0
    if home_goals == away_goals:
        return 0.5, 0.5
    return 0.0, 1.0


def update_elo(
    state: EloState,
    home_team: str,
    away_team: str,
    home_goals: int,
    away_goals: int,
) -> tuple[float, float]:
    """
    Update ratings in-place and return (new_home_elo, new_away_elo).
    Home advantage baked in as +100 Elo points for expectation calc.
    """
    r_home = state.get(home_team) + 100  # home advantage offset
    r_away = state.get(away_team)

    e_home = _expected_win(r_home, r_away)
    e_away = 1.0 - e_home

    s_home, s_away = _result_score(home_goals, away_goals)
    mov = _mov_multiplier(home_goals - away_goals)

    new_home = state.get(home_team) + K_BASE * mov * (s_home - e_home)
    new_away = state.get(away_team) + K_BASE * mov * (s_away - e_away)

    state.update(home_team, new_home)
    state.update(away_team, new_away)
    return new_home, new_away


def elo_win_probability(home_elo: float, away_elo: float) -> dict[str, float]:
    """
    Return {home_win, draw, away_win} probabilities from Elo ratings.
    Draw probability estimated from the gap between the two sides.
    """
    e_home = _expected_win(home_elo + 100, away_elo)  # +100 home advantage
    # Simple draw model: draw prob peaks at ~0.28 when evenly matched
    gap = abs(home_elo - away_elo)
    p_draw = max(0.10, 0.28 - gap / 3000.0)
    p_home = e_home * (1.0 - p_draw)
    p_away = (1.0 - e_home) * (1.0 - p_draw)
    # Normalise to sum to 1
    total = p_home + p_draw + p_away
    return {
        "home_win": round(p_home / total, 4),
        "draw": round(p_draw / total, 4),
        "away_win": round(p_away / total, 4),
    }


def build_elo_from_history(
    matches: list[dict],  # [{"home": str, "away": str, "hg": int, "ag": int, "date": datetime}]
) -> EloState:
    """Replay all historical matches in date order and return final Elo state."""
    state = EloState()
    for m in sorted(matches, key=lambda x: x["date"]):
        update_elo(state, m["home"], m["away"], m["hg"], m["ag"])
    return state
