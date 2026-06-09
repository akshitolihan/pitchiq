from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from api.database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, unique=True, index=True)
    generated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    model_version = Column(String, default="dixon-coles-v1")

    # Dixon-Coles expected goals
    lambda_home = Column(Float, nullable=False)
    lambda_away = Column(Float, nullable=False)

    # Market probabilities
    p_home_win = Column(Float, nullable=False)
    p_draw = Column(Float, nullable=False)
    p_away_win = Column(Float, nullable=False)
    p_over_2_5 = Column(Float, nullable=False)
    p_under_2_5 = Column(Float, nullable=False)
    p_btts = Column(Float, nullable=False)

    # Top correct-score cells [{score: "2-1", prob: 0.12}, ...]
    top_correct_scores = Column(JSON, default=list)

    # Confidence: High | Medium | Low
    confidence = Column(String, nullable=False)

    # Explainability drivers: {team_strength, home_advantage, recent_form, data_completeness}
    drivers = Column(JSON, default=dict)

    # Elo cross-check
    elo_home_win_prob = Column(Float, nullable=True)

    match = relationship("Match", back_populates="prediction")
