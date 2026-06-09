from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from api.database import Base


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    league_id = Column(Integer, nullable=True, index=True)
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    kickoff_utc = Column(DateTime(timezone=True), nullable=False, index=True)

    # scheduled | finished
    status = Column(String, default="scheduled", nullable=False)

    # Results (null until finished)
    home_goals = Column(Integer, nullable=True)
    away_goals = Column(Integer, nullable=True)
    home_xg = Column(Float, nullable=True)
    away_xg = Column(Float, nullable=True)

    # Context
    home_rest_days = Column(Integer, nullable=True)
    away_rest_days = Column(Integer, nullable=True)
    midweek_european_flag = Column(Boolean, default=False)
    weather = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    home_team = relationship("Team", foreign_keys=[home_team_id], back_populates="home_matches")
    away_team = relationship("Team", foreign_keys=[away_team_id], back_populates="away_matches")
    stats = relationship("MatchStats", back_populates="match", cascade="all, delete-orphan")
    prediction = relationship("Prediction", back_populates="match", uselist=False, cascade="all, delete-orphan")
