import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

db_url = os.environ.get("DATABASE_URL")
if not db_url:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    db_file = os.path.join(base_dir, "vigil.db")
    db_url = f"sqlite:///{db_file}"

engine = create_engine(db_url, connect_args={"check_same_thread": False} if db_url.startswith("sqlite") else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
