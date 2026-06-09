"""
Seed script — idempotent.

1. Ingest EPL 2023-24 results from data/seed/epl_2324.csv
2. Create synthetic upcoming fixtures (next 10 matchday fixtures)
3. Fit Dixon-Coles + Elo
4. Generate predictions for all upcoming fixtures

Run standalone:
    python -m scripts.seed

Or called from POST /api/admin/seed
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Allow running from repo root
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session

from api.database import Base, SessionLocal, engine
from api.ingestion.football_data_csv import FootballDataCsvAdapter
from api.jobs.fit_and_predict import run_fit_and_predict
from api.models.match import Match
from api.models.match_stats import MatchStats
from api.models.team import Team
from api.models.user import User

SEED_CSV = Path(__file__).parent.parent / "data" / "seed" / "epl_2324.csv"

# Upcoming fixtures to synthesise (pairs of team names from the 2023-24 table)
UPCOMING_FIXTURES = [
    ("Arsenal", "Manchester City"),
    ("Liverpool", "Tottenham Hotspur"),
    ("Manchester United", "Chelsea"),
    ("Newcastle United", "Aston Villa"),
    ("Brighton & Hove Albion", "Wolverhampton"),
    ("Fulham", "Brentford"),
    ("Crystal Palace", "Everton"),
    ("Nottingham Forest", "West Ham United"),
    ("Bournemouth", "Luton"),
    ("Burnley", "Sheffield Utd"),
]


def _get_or_create_team(db: Session, name: str) -> Team:
    team = db.query(Team).filter(Team.name == name).first()
    if not team:
        team = Team(name=name, country="England")
        db.add(team)
        db.flush()
    return team


def run_seed(db: Session) -> dict:
    Base.metadata.create_all(bind=engine)

    adapter = FootballDataCsvAdapter(str(SEED_CSV))
    results = adapter.fetch_results()

    if not results:
        return {"status": "error", "detail": "No results loaded from CSV"}

    # Upsert teams
    team_cache: dict[str, Team] = {}
    for r in results:
        for name in (r.home_team, r.away_team):
            if name not in team_cache:
                team_cache[name] = _get_or_create_team(db, name)

    # Upsert finished matches
    inserted = 0
    for r in results:
        existing = (
            db.query(Match)
            .filter(
                Match.home_team_id == team_cache[r.home_team].id,
                Match.away_team_id == team_cache[r.away_team].id,
                Match.kickoff_utc == r.kickoff_utc,
            )
            .first()
        )
        if existing:
            continue

        match = Match(
            home_team_id=team_cache[r.home_team].id,
            away_team_id=team_cache[r.away_team].id,
            kickoff_utc=r.kickoff_utc,
            status="finished",
            home_goals=r.home_goals,
            away_goals=r.away_goals,
        )
        db.add(match)
        db.flush()

        # MatchStats rows
        for team_name, shots, sot, corners, yellow, red in [
            (r.home_team, r.home_shots, r.home_shots_on_target, r.home_corners, r.home_yellow, r.home_red),
            (r.away_team, r.away_shots, r.away_shots_on_target, r.away_corners, r.away_yellow, r.away_red),
        ]:
            if any(v is not None for v in [shots, sot, corners]):
                db.add(MatchStats(
                    match_id=match.id,
                    team_id=team_cache[team_name].id,
                    shots=shots,
                    shots_on_target=sot,
                    corners=corners,
                    yellow_cards=yellow,
                    red_cards=red,
                ))

        inserted += 1

    db.commit()

    # Synthesise upcoming fixtures (1 week ahead, one per day)
    base_date = datetime.now(timezone.utc).replace(hour=15, minute=0, second=0, microsecond=0)
    upcoming_inserted = 0
    for i, (home_name, away_name) in enumerate(UPCOMING_FIXTURES):
        home = _get_or_create_team(db, home_name)
        away = _get_or_create_team(db, away_name)
        kickoff = base_date + timedelta(days=i + 1)

        existing = (
            db.query(Match)
            .filter(
                Match.home_team_id == home.id,
                Match.away_team_id == away.id,
                Match.status == "scheduled",
            )
            .first()
        )
        if not existing:
            db.add(Match(
                home_team_id=home.id,
                away_team_id=away.id,
                kickoff_utc=kickoff,
                status="scheduled",
            ))
            upcoming_inserted += 1

    db.commit()

    # Seed a stub user for each tier (for testing)
    for tier in ("free", "paid", "pro"):
        if not db.query(User).filter(User.tier == tier).first():
            db.add(User(email=f"{tier}@example.com", country="GB", tier=tier))
    db.commit()

    # Fit model + generate predictions
    fit_result = run_fit_and_predict(db)

    return {
        "status": "ok",
        "historical_matches_inserted": inserted,
        "upcoming_fixtures_inserted": upcoming_inserted,
        **fit_result,
    }


if __name__ == "__main__":
    db = SessionLocal()
    try:
        result = run_seed(db)
        print(result)
    finally:
        db.close()
