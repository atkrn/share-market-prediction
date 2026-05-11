import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
from dotenv import load_dotenv
from database.models import Base, User, AVATAR_COLORS
import bcrypt

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/teammanager.db")

# SQLite needs check_same_thread=False for Streamlit
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Create all tables and seed an admin user if the DB is empty."""
    os.makedirs("data",    exist_ok=True)
    os.makedirs("uploads", exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _seed_default_admin()


def _seed_default_admin():
    """Create a default admin account on first run."""
    with get_db() as db:
        if db.query(User).count() == 0:
            hashed = bcrypt.hashpw(b"admin1234", bcrypt.gensalt()).decode()
            admin = User(
                name          = "Admin User",
                email         = "admin@teamsync.ai",
                password_hash = hashed,
                role          = "admin",
                avatar_color  = AVATAR_COLORS[0],
                bio           = "Platform administrator",
                skills        = "Management, Planning",
            )
            db.add(admin)
            db.commit()


@contextmanager
def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
