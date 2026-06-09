"""
FastAPI application entry point.
Exported as `app` for Vercel Python runtime and uvicorn.
"""
from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from api.config import settings
from api.database import Base, engine, get_db
from api.middleware.tier_gate import TierGateMiddleware
from api.routes.fixtures import router as fixtures_router
from api.routes.matches import router as matches_router
from api.jobs.fit_and_predict import run_fit_and_predict

import os
import threading

# Create all tables on startup (idempotent — safe to call repeatedly)
Base.metadata.create_all(bind=engine)


def _auto_seed_if_empty():
    """
    On cold start (especially on Vercel Lambda), seed the DB if it has no
    finished matches. Runs in a background thread so it doesn't block startup.
    """
    try:
        from api.database import SessionLocal
        from api.models.match import Match
        db = SessionLocal()
        count = db.query(Match).filter(Match.status == "finished").count()
        db.close()
        if count == 0:
            db = SessionLocal()
            try:
                from scripts.seed import run_seed
                run_seed(db)
            finally:
                db.close()
    except Exception as e:
        print(f"[auto-seed] error: {e}")


# Seed in background thread — non-blocking; first /fixtures request may return
# empty list while seed runs, then populate on next request (ISR re-validates).
threading.Thread(target=_auto_seed_if_empty, daemon=True).start()

app = FastAPI(
    title="Football Analysis API",
    description=(
        "Probability-based football match analysis. "
        "This is an analysis product — not a betting operator. "
        "Probabilities are model estimates, not guarantees."
    ),
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tier gating + geofence (runs on every request)
app.add_middleware(TierGateMiddleware)

# Routers
app.include_router(fixtures_router)
app.include_router(matches_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/debug/db")
def debug_db(db: Session = Depends(get_db)):
    from api.models.match import Match
    from api.models.prediction import Prediction
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    total = db.query(Match).count()
    scheduled = db.query(Match).filter(Match.status == "scheduled").count()
    future = db.query(Match).filter(Match.status == "scheduled", Match.kickoff_utc >= now).count()
    preds = db.query(Prediction).count()
    return {
        "db_url_prefix": settings.database_url[:30],
        "total_matches": total,
        "scheduled_matches": scheduled,
        "future_scheduled": future,
        "predictions": preds,
        "now_utc": now.isoformat(),
    }


@app.post("/api/admin/fit")
def trigger_fit(request: Request, db: Session = Depends(get_db)):
    """
    Trigger a model fit + prediction generation pass.
    Protected by ADMIN_SECRET header.
    """
    secret = request.headers.get("X-Admin-Secret", "")
    if secret != settings.admin_secret:
        raise HTTPException(status_code=401, detail="Invalid admin secret.")
    result = run_fit_and_predict(db)
    return result


@app.post("/api/admin/seed")
def trigger_seed(request: Request, db: Session = Depends(get_db)):
    """
    Ingest seed CSV and run initial model fit.
    Protected by ADMIN_SECRET header.
    Idempotent — safe to call multiple times.
    """
    secret = request.headers.get("X-Admin-Secret", "")
    if secret != settings.admin_secret:
        raise HTTPException(status_code=401, detail="Invalid admin secret.")

    from scripts.seed import run_seed
    result = run_seed(db)
    return result
