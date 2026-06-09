from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime, timezone
from api.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=True)
    country = Column(String, nullable=True)

    # free | paid | pro — enforced server-side, never just hidden in UI
    tier = Column(String, default="free", nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
