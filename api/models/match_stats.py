from sqlalchemy import Column, Integer, Float, ForeignKey, String
from sqlalchemy.orm import relationship
from api.database import Base


class MatchStats(Base):
    __tablename__ = "match_stats"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)

    shots = Column(Integer, nullable=True)
    shots_on_target = Column(Integer, nullable=True)
    xg = Column(Float, nullable=True)
    possession = Column(Float, nullable=True)
    passes = Column(Integer, nullable=True)
    conversion_rate = Column(Float, nullable=True)
    fouls = Column(Integer, nullable=True)
    corners = Column(Integer, nullable=True)
    yellow_cards = Column(Integer, nullable=True)
    red_cards = Column(Integer, nullable=True)

    match = relationship("Match", back_populates="stats")
