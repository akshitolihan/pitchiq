from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from api.config import settings

# SQLite needs check_same_thread=False; ignored by other dialects
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

# Use pg8000 driver (pure Python, no pg_config needed) for postgres URLs
def _resolve_url(url: str) -> str:
    if url.startswith("postgresql://") or url.startswith("postgres://"):
        return url.replace("postgresql://", "postgresql+pg8000://", 1).replace("postgres://", "postgresql+pg8000://", 1)
    return url

engine = create_engine(_resolve_url(settings.database_url), connect_args=connect_args)

# Enable WAL mode for SQLite concurrency
if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA journal_mode=WAL")
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
