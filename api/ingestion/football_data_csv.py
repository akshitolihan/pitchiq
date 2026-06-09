"""
Adapter for football-data.co.uk free CSV files.
Format: E0.csv (Premier League), E1.csv (Championship), etc.

Column reference (subset we use):
  Date, HomeTeam, AwayTeam, FTHG, FTAG, FTR, HS, AS, HST, AST, HC, AC, HY, AY, HR, AR
"""
import csv
import io
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import httpx

from api.ingestion.base import AbstractDataAdapter, ResultRecord, FixtureRecord


# Map football-data team names to canonical names
TEAM_NAME_MAP: dict[str, str] = {
    "Man City": "Manchester City",
    "Man United": "Manchester United",
    "Nott'm Forest": "Nottingham Forest",
    "Sheffield United": "Sheffield Utd",
    "Tottenham": "Tottenham Hotspur",
    "Newcastle": "Newcastle United",
    "West Ham": "West Ham United",
    "Wolves": "Wolverhampton",
    "Brighton": "Brighton & Hove Albion",
}


def _norm(name: str) -> str:
    return TEAM_NAME_MAP.get(name.strip(), name.strip())


def _safe_int(val: str) -> Optional[int]:
    try:
        return int(val) if val.strip() else None
    except (ValueError, AttributeError):
        return None


def _parse_date(val: str) -> Optional[datetime]:
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(val.strip(), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


class FootballDataCsvAdapter(AbstractDataAdapter):
    """
    Reads a football-data.co.uk CSV from a local file path or a URL.
    All rows with a valid score are treated as results; rows with no score
    but a future date become fixture stubs.
    """

    def __init__(self, source: str, season: str = "2023-24", league: str = "Premier League"):
        self.source = source  # file path or https:// URL
        self.season = season
        self.league = league
        self._rows: list[dict] | None = None

    def _load(self) -> list[dict]:
        if self._rows is not None:
            return self._rows
        if self.source.startswith("http"):
            resp = httpx.get(self.source, timeout=30)
            resp.raise_for_status()
            text = resp.text
        else:
            text = Path(self.source).read_text(encoding="utf-8-sig")

        reader = csv.DictReader(io.StringIO(text))
        self._rows = [r for r in reader if r.get("HomeTeam", "").strip()]
        return self._rows

    def fetch_results(self) -> list[ResultRecord]:
        results = []
        for i, row in enumerate(self._load()):
            home = _norm(row.get("HomeTeam", ""))
            away = _norm(row.get("AwayTeam", ""))
            fthg = _safe_int(row.get("FTHG", ""))
            ftag = _safe_int(row.get("FTAG", ""))
            date = _parse_date(row.get("Date", ""))

            if not home or not away or fthg is None or ftag is None or date is None:
                continue

            results.append(ResultRecord(
                external_id=f"fdc-{self.season}-{i}",
                home_team=home,
                away_team=away,
                kickoff_utc=date,
                home_goals=fthg,
                away_goals=ftag,
                home_shots=_safe_int(row.get("HS", "")),
                away_shots=_safe_int(row.get("AS", "")),
                home_shots_on_target=_safe_int(row.get("HST", "")),
                away_shots_on_target=_safe_int(row.get("AST", "")),
                home_corners=_safe_int(row.get("HC", "")),
                away_corners=_safe_int(row.get("AC", "")),
                home_yellow=_safe_int(row.get("HY", "")),
                away_yellow=_safe_int(row.get("AY", "")),
                home_red=_safe_int(row.get("HR", "")),
                away_red=_safe_int(row.get("AR", "")),
                league=self.league,
                season=self.season,
            ))
        return results

    def fetch_fixtures(self) -> list[FixtureRecord]:
        """
        football-data.co.uk historical CSVs don't include future fixtures.
        A live feed adapter would populate this. Returns empty list here.
        """
        return []
