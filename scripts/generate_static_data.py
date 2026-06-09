"""
Run during `next build` (via package.json prebuild) to produce
src/data/fixtures.json with pre-computed Dixon-Coles predictions.

The JSON is imported directly by the Next.js pages — no database or
runtime API call needed for the fixtures list.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from api.database import Base, SessionLocal, engine
from scripts.seed import run_seed


OUTPUT = Path(__file__).parent.parent / "src" / "data" / "fixtures.json"


def main():
    # Use an in-memory SQLite for the build step
    os.environ.setdefault("DATABASE_URL", "sqlite:///./build_data.db")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_result = run_seed(db)
        print("Seed result:", seed_result)

        from api.models.match import Match
        from sqlalchemy.orm import joinedload

        scheduled = (
            db.query(Match)
            .options(
                joinedload(Match.home_team),
                joinedload(Match.away_team),
                joinedload(Match.prediction),
            )
            .filter(Match.status == "scheduled")
            .order_by(Match.kickoff_utc)
            .all()
        )

        fixtures = []
        for m in scheduled:
            pred = m.prediction
            fixtures.append({
                "id": m.id,
                "home_team": m.home_team.name,
                "away_team": m.away_team.name,
                "home_elo": round(m.home_team.current_elo or 1500, 0),
                "away_elo": round(m.away_team.current_elo or 1500, 0),
                "home_attack": m.home_team.attack_strength,
                "away_attack": m.away_team.attack_strength,
                "kickoff_utc": m.kickoff_utc.isoformat(),
                "status": m.status,
                "prediction": {
                    "p_home_win": pred.p_home_win,
                    "p_draw": pred.p_draw,
                    "p_away_win": pred.p_away_win,
                    "p_over_2_5": pred.p_over_2_5,
                    "p_under_2_5": pred.p_under_2_5,
                    "p_btts": pred.p_btts,
                    "lambda_home": pred.lambda_home,
                    "lambda_away": pred.lambda_away,
                    "confidence": pred.confidence,
                    "top_correct_scores": pred.top_correct_scores,
                    "drivers": pred.drivers,
                    "elo_home_win_prob": pred.elo_home_win_prob,
                    "model_version": pred.model_version,
                    "generated_at": pred.generated_at.isoformat() if pred.generated_at else None,
                } if pred else None,
            })

        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps({"fixtures": fixtures, "total": len(fixtures)}, indent=2))
        print(f"Wrote {len(fixtures)} fixtures to {OUTPUT}")

    finally:
        db.close()
        # Clean up build DB
        Path("build_data.db").unlink(missing_ok=True)


if __name__ == "__main__":
    main()
