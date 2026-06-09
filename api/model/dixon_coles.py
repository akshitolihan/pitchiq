"""
Dixon-Coles goals model.

Estimates per-team attack (alpha) and defense (beta) strengths plus a
league-level home-advantage (gamma) and a low-score correction (rho)
via maximum likelihood over historical matches with time-decay weighting.

Reference: Dixon & Coles (1997) "Modelling Association Football Scores
and Inefficiencies in the Football Betting Market."
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import numpy as np
from scipy.optimize import minimize
from scipy.stats import poisson


@dataclass
class MatchRecord:
    home_team: str
    away_team: str
    home_goals: int
    away_goals: int
    date: datetime


@dataclass
class ScorelineMatrix:
    matrix: np.ndarray          # matrix[home_goals, away_goals]
    lambda_home: float
    lambda_away: float
    p_home_win: float
    p_draw: float
    p_away_win: float
    p_over_2_5: float
    p_under_2_5: float
    p_btts: float
    top_correct_scores: list[dict]  # [{score, prob}, ...]


class DixonColesModel:
    """
    Parameters stored after fitting:
      alpha[i]  — attack strength of team i  (Σ alpha = 0 by constraint)
      beta[i]   — defense strength of team i
      gamma     — home advantage (scalar)
      rho       — DC low-score correction (scalar, in (-1, 1))
    """

    MAX_GOALS = 9          # scoreline matrix dimension
    TOP_SCORES_N = 5       # how many top correct-score cells to return

    def __init__(self, xi: float = 0.0018):
        self.xi = xi       # time-decay rate (per day)
        self.teams: list[str] = []
        self._alpha: np.ndarray | None = None
        self._beta: np.ndarray | None = None
        self._gamma: float = 0.0
        self._rho: float = 0.0
        self.fitted = False
        self.n_matches_used: int = 0

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _tau(x: int, y: int, lh: float, la: float, rho: float) -> float:
        """Dixon-Coles low-score correction factor."""
        if x == 0 and y == 0:
            return 1.0 - lh * la * rho
        if x == 1 and y == 0:
            return 1.0 + la * rho
        if x == 0 and y == 1:
            return 1.0 + lh * rho
        if x == 1 and y == 1:
            return 1.0 - rho
        return 1.0

    def _lambdas(self, hi: int, ai: int, params: np.ndarray) -> tuple[float, float]:
        n = len(self.teams)
        alpha = params[:n]
        beta = params[n:2 * n]
        gamma = params[2 * n]
        lh = math.exp(alpha[hi] - beta[ai] + gamma)
        la = math.exp(alpha[ai] - beta[hi])
        return lh, la

    def _neg_log_likelihood(
        self,
        params: np.ndarray,
        match_data: list[dict],
        weights: np.ndarray,
    ) -> float:
        n = len(self.teams)
        rho = params[2 * n + 1]
        total = 0.0
        for i, m in enumerate(match_data):
            lh, la = self._lambdas(m["hi"], m["ai"], params)
            if lh <= 0 or la <= 0:
                return 1e12
            x, y = m["hg"], m["ag"]
            t = self._tau(x, y, lh, la, rho)
            if t <= 0:
                return 1e12
            log_p = (
                math.log(t)
                + x * math.log(lh) - lh - math.lgamma(x + 1)
                + y * math.log(la) - la - math.lgamma(y + 1)
            )
            total += weights[i] * log_p
        return -total

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def fit(self, matches: list[MatchRecord], reference_date: Optional[datetime] = None) -> "DixonColesModel":
        if not matches:
            raise ValueError("Need at least one match to fit")

        ref = reference_date or datetime.now(timezone.utc)

        teams_set: set[str] = set()
        for m in matches:
            teams_set.add(m.home_team)
            teams_set.add(m.away_team)
        self.teams = sorted(teams_set)
        n = len(self.teams)
        idx = {t: i for i, t in enumerate(self.teams)}

        weights = np.array([
            math.exp(-self.xi * max((ref - m.date.replace(tzinfo=timezone.utc) if m.date.tzinfo is None else ref - m.date).days, 0))
            for m in matches
        ], dtype=float)

        match_data = [
            {"hi": idx[m.home_team], "ai": idx[m.away_team], "hg": m.home_goals, "ag": m.away_goals}
            for m in matches
        ]

        # Initial params: zeros for alpha/beta, 0.3 for gamma, 0.1 for rho
        x0 = np.zeros(2 * n + 2)
        x0[2 * n] = 0.3      # gamma
        x0[2 * n + 1] = 0.1  # rho

        bounds = (
            [(None, None)] * n +   # alpha
            [(None, None)] * n +   # beta
            [(0.0, 2.0)] +         # gamma >= 0
            [(-0.99, 0.99)]        # rho in open (-1, 1)
        )

        # Σ alpha_i = 0 for identifiability
        constraints = [{"type": "eq", "fun": lambda p, _n=n: np.sum(p[:_n])}]

        result = minimize(
            self._neg_log_likelihood,
            x0,
            args=(match_data, weights),
            method="SLSQP",
            bounds=bounds,
            constraints=constraints,
            options={"maxiter": 1000, "ftol": 1e-9},
        )

        params = result.x
        self._alpha = params[:n]
        self._beta = params[n:2 * n]
        self._gamma = float(params[2 * n])
        self._rho = float(params[2 * n + 1])
        self.fitted = True
        self.n_matches_used = len(matches)
        return self

    def predict(self, home_team: str, away_team: str) -> ScorelineMatrix:
        if not self.fitted:
            raise RuntimeError("Model has not been fitted yet")
        if home_team not in self.teams:
            raise ValueError(f"Unknown team: {home_team}")
        if away_team not in self.teams:
            raise ValueError(f"Unknown team: {away_team}")

        hi = self.teams.index(home_team)
        ai = self.teams.index(away_team)

        n = len(self.teams)
        params = np.concatenate([self._alpha, self._beta, [self._gamma, self._rho]])
        lh, la = self._lambdas(hi, ai, params)

        mg = self.MAX_GOALS
        matrix = np.zeros((mg, mg))
        for x in range(mg):
            for y in range(mg):
                t = self._tau(x, y, lh, la, self._rho)
                matrix[x, y] = t * poisson.pmf(x, lh) * poisson.pmf(y, la)

        matrix = np.clip(matrix, 0, None)
        total = matrix.sum()
        if total > 0:
            matrix /= total

        # Derived markets
        p_home = float(np.tril(matrix, -1).sum())   # home goals > away goals
        p_draw = float(np.diag(matrix).sum())
        p_away = float(np.triu(matrix, 1).sum())    # away goals > home goals

        goals_grid = np.add.outer(np.arange(mg), np.arange(mg))
        p_over = float(matrix[goals_grid > 2].sum())
        p_under = 1.0 - p_over

        btts_mask = np.ones((mg, mg), dtype=bool)
        btts_mask[0, :] = False
        btts_mask[:, 0] = False
        p_btts = float(matrix[btts_mask].sum())

        # Top correct scores
        flat = matrix.flatten()
        top_idx = np.argsort(flat)[::-1][:self.TOP_SCORES_N]
        top_scores = []
        for idx in top_idx:
            h, a = divmod(int(idx), mg)
            top_scores.append({"score": f"{h}-{a}", "prob": round(float(flat[idx]), 4)})

        return ScorelineMatrix(
            matrix=matrix,
            lambda_home=round(lh, 4),
            lambda_away=round(la, 4),
            p_home_win=round(p_home, 4),
            p_draw=round(p_draw, 4),
            p_away_win=round(p_away, 4),
            p_over_2_5=round(p_over, 4),
            p_under_2_5=round(p_under, 4),
            p_btts=round(p_btts, 4),
            top_correct_scores=top_scores,
        )

    def team_params(self, team: str) -> dict:
        """Return attack/defense params for a team (for storage in DB)."""
        if not self.fitted or team not in self.teams:
            return {}
        i = self.teams.index(team)
        return {
            "attack_strength": round(float(self._alpha[i]), 4),
            "defense_strength": round(float(self._beta[i]), 4),
            "home_advantage": round(self._gamma, 4),
        }
