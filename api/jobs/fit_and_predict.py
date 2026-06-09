"""
Triggerable job: fit Dixon-Coles model and generate predictions.

Called:
  - At startup after seed (via scripts/seed.py)
  - POST /api/admin/fit  (admin-secret protected)
  - Scheduled nightly (Vercel Cron or external scheduler)
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from api.model.predictor import fit_model, generate_predictions


def run_fit_and_predict(db: Session) -> dict:
    dc, elo_state = fit_model(db)
    n = generate_predictions(db, dc, elo_state)
    return {
        "status": "ok",
        "teams_fitted": len(dc.teams),
        "matches_used": dc.n_matches_used,
        "predictions_written": n,
        "home_advantage_gamma": round(dc._gamma, 4),
    }
