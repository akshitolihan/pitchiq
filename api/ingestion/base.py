"""
Abstract adapter interface for data ingestion.

New feed providers (API-Football, Opta, etc.) implement this contract
without touching the model or job layer.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class FixtureRecord:
    external_id: str
    home_team: str
    away_team: str
    kickoff_utc: datetime
    league: str = "Premier League"
    season: str = "2023-24"


@dataclass
class ResultRecord:
    external_id: str
    home_team: str
    away_team: str
    kickoff_utc: datetime
    home_goals: int
    away_goals: int
    home_shots: Optional[int] = None
    away_shots: Optional[int] = None
    home_shots_on_target: Optional[int] = None
    away_shots_on_target: Optional[int] = None
    home_corners: Optional[int] = None
    away_corners: Optional[int] = None
    home_yellow: Optional[int] = None
    away_yellow: Optional[int] = None
    home_red: Optional[int] = None
    away_red: Optional[int] = None
    # xG not in free CSVs — populated by richer adapters
    home_xg: Optional[float] = None
    away_xg: Optional[float] = None
    league: str = "Premier League"
    season: str = "2023-24"


class AbstractDataAdapter(ABC):
    """All data sources implement this interface."""

    @abstractmethod
    def fetch_results(self) -> list[ResultRecord]:
        """Return historical finished matches."""

    @abstractmethod
    def fetch_fixtures(self) -> list[FixtureRecord]:
        """Return upcoming (unplayed) fixtures."""
