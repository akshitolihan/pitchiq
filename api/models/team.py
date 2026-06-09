from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from api.database import Base


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    short_name = Column(String, nullable=True)
    country = Column(String, default="England")
    league_id = Column(Integer, nullable=True)

    # Dixon-Coles parameters (updated after each model fit)
    attack_strength = Column(Float, nullable=True)
    defense_strength = Column(Float, nullable=True)

    # Elo
    current_elo = Column(Float, default=1500.0)

    last_rating_update = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    home_matches = relationship("Match", foreign_keys="Match.home_team_id", back_populates="home_team")
    away_matches = relationship("Match", foreign_keys="Match.away_team_id", back_populates="away_team")
