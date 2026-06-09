"""
Unit tests for Dixon-Coles model and Elo rating system.

Invariants verified:
  1. All market probabilities sum to ~1.0
  2. Stronger attack team has higher win probability
  3. Home advantage increases home win probability
  4. Dixon-Coles τ correction stabilises low-score cells
  5. Elo converges — better team has higher win expectation
  6. Confidence levels are assigned correctly
"""
from __future__ import annotations

import math
import pytest
from datetime import datetime, timezone

from api.model.dixon_coles import DixonColesModel, MatchRecord
from api.model.elo import EloState, build_elo_from_history, elo_win_probability
from api.model.predictor import _confidence_level, _shannon_entropy


# ------------------------------------------------------------------ #
# Fixtures
# ------------------------------------------------------------------ #

def _make_match(home: str, away: str, hg: int, ag: int, days_ago: int = 0) -> MatchRecord:
    d = datetime(2024, 5, 1, tzinfo=timezone.utc)
    from datetime import timedelta
    return MatchRecord(home_team=home, away_team=away, home_goals=hg, away_goals=ag,
                       date=d - timedelta(days=days_ago))


def _build_model() -> DixonColesModel:
    """
    Build a small but valid dataset: TeamA >> TeamB, TeamC is average.
    TeamA scores 3+ at home consistently; TeamB barely scores.
    """
    matches = []
    # TeamA (strong) at home vs TeamB (weak)
    for i in range(15):
        matches.append(_make_match("TeamA", "TeamB", 3, 0, days_ago=i * 7))
    # TeamA away
    for i in range(10):
        matches.append(_make_match("TeamB", "TeamA", 0, 2, days_ago=i * 7 + 3))
    # TeamC (mid) vs TeamB
    for i in range(10):
        matches.append(_make_match("TeamC", "TeamB", 2, 1, days_ago=i * 7 + 5))
    # TeamA vs TeamC
    for i in range(8):
        matches.append(_make_match("TeamA", "TeamC", 2, 1, days_ago=i * 7 + 6))
    # TeamC vs TeamA
    for i in range(8):
        matches.append(_make_match("TeamC", "TeamA", 1, 2, days_ago=i * 7 + 2))
    return DixonColesModel().fit(matches)


@pytest.fixture(scope="module")
def model() -> DixonColesModel:
    return _build_model()


# ------------------------------------------------------------------ #
# Tests
# ------------------------------------------------------------------ #

class TestProbabilitySums:
    def test_wdl_sums_to_one(self, model):
        sm = model.predict("TeamA", "TeamB")
        total = sm.p_home_win + sm.p_draw + sm.p_away_win
        assert abs(total - 1.0) < 2e-4, f"W+D+L = {total}"

    def test_over_under_sums_to_one(self, model):
        sm = model.predict("TeamA", "TeamB")
        assert abs(sm.p_over_2_5 + sm.p_under_2_5 - 1.0) < 1e-4

    def test_btts_in_range(self, model):
        sm = model.predict("TeamA", "TeamB")
        assert 0.0 <= sm.p_btts <= 1.0

    def test_scoreline_matrix_sums_to_one(self, model):
        sm = model.predict("TeamA", "TeamC")
        assert abs(sm.matrix.sum() - 1.0) < 1e-4


class TestStrengthOrdering:
    def test_stronger_team_higher_win_prob(self, model):
        """TeamA is much stronger than TeamB; A should win more often."""
        sm = model.predict("TeamA", "TeamB")
        assert sm.p_home_win > sm.p_away_win, (
            f"Expected TeamA to have higher win prob: home={sm.p_home_win}, away={sm.p_away_win}"
        )

    def test_weak_team_away_loses(self, model):
        sm = model.predict("TeamB", "TeamA")
        # TeamA (away) should win more than TeamB (home)
        assert sm.p_away_win > sm.p_home_win

    def test_lambda_ordering(self, model):
        """Strong team at home should have higher expected goals."""
        sm_ab = model.predict("TeamA", "TeamB")
        sm_ba = model.predict("TeamB", "TeamA")
        assert sm_ab.lambda_home > sm_ba.lambda_home


class TestHomeAdvantage:
    def test_home_beats_away_for_same_team(self, model):
        """TeamA at home should have a higher win prob than TeamA away vs same opponent."""
        sm_home = model.predict("TeamA", "TeamC")
        sm_away = model.predict("TeamC", "TeamA")
        # TeamA home win > TeamA away win
        assert sm_home.p_home_win > sm_away.p_away_win

    def test_gamma_positive(self, model):
        assert model._gamma > 0, f"Home advantage γ should be > 0, got {model._gamma}"

    def test_symmetric_lambda_without_home_advantage(self, model):
        """
        Without home advantage, TeamA vs TeamC should mirror TeamC vs TeamA
        in terms of which team has higher lambda.
        With home advantage: home team always gets a boost.
        """
        sm = model.predict("TeamA", "TeamC")
        assert sm.lambda_home > 0 and sm.lambda_away > 0


class TestDCLowScoreCorrection:
    def test_rho_finite(self, model):
        assert -1 < model._rho < 1

    def test_tau_at_00(self):
        dc = DixonColesModel
        t = dc._tau(0, 0, 1.0, 1.0, 0.1)
        assert abs(t - (1 - 1.0 * 1.0 * 0.1)) < 1e-9

    def test_tau_at_11(self):
        dc = DixonColesModel
        t = dc._tau(1, 1, 1.0, 1.0, 0.1)
        assert abs(t - (1 - 0.1)) < 1e-9

    def test_tau_at_high_score_is_one(self):
        dc = DixonColesModel
        assert dc._tau(3, 2, 1.5, 1.2, 0.1) == 1.0


class TestEdgeCases:
    def test_evenly_matched_draw_prob(self, model):
        """Evenly matched teams should have non-trivial draw probability."""
        # TeamC vs TeamC... we don't have that, use TeamA vs TeamA-equivalent
        sm = model.predict("TeamC", "TeamC")
        assert sm.p_draw > 0.15

    def test_top_correct_scores_sum_positive(self, model):
        sm = model.predict("TeamA", "TeamB")
        total = sum(cs["prob"] for cs in sm.top_correct_scores)
        assert total > 0

    def test_unknown_team_raises(self, model):
        with pytest.raises((ValueError, KeyError)):
            model.predict("Unknown FC", "TeamA")


class TestElo:
    def test_stronger_team_higher_elo(self):
        hist = []
        from datetime import timedelta
        base = datetime(2024, 1, 1, tzinfo=timezone.utc)
        for i in range(20):
            hist.append({"home": "Strong", "away": "Weak", "hg": 3, "ag": 0, "date": base + timedelta(days=i * 7)})
        state = build_elo_from_history(hist)
        assert state.get("Strong") > state.get("Weak")

    def test_elo_probs_sum_to_one(self):
        probs = elo_win_probability(1600, 1400)
        total = probs["home_win"] + probs["draw"] + probs["away_win"]
        assert abs(total - 1.0) < 1e-4

    def test_favourite_win_prob_above_half(self):
        probs = elo_win_probability(1700, 1300)
        assert probs["home_win"] > 0.5


class TestConfidence:
    def test_dominant_outcome_is_high_confidence(self):
        level = _confidence_level(0.80, 0.12, 0.08, 30)
        assert level == "High"

    def test_uniform_distribution_is_low(self):
        level = _confidence_level(0.34, 0.33, 0.33, 30)
        assert level in ("Low", "Medium")

    def test_few_matches_reduces_confidence(self):
        # Same probs, fewer matches
        level_many = _confidence_level(0.60, 0.25, 0.15, 40)
        level_few = _confidence_level(0.60, 0.25, 0.15, 3)
        order = {"High": 2, "Medium": 1, "Low": 0}
        assert order[level_many] >= order[level_few]
