import bcrypt
import os
import random
from database.connection import get_db
from database.models import User, AVATAR_COLORS


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def authenticate_user(email: str, password: str) -> dict | None:
    """Return user dict on success, None on failure."""
    with get_db() as db:
        user = db.query(User).filter(User.email == email.lower().strip(), User.is_active == True).first()
        if user and _verify(password, user.password_hash):
            return user.to_dict()
    return None


def register_user(name: str, email: str, password: str, role: str = "member") -> dict:
    """Create a new user. Returns {success, message}."""
    with get_db() as db:
        existing = db.query(User).filter(User.email == email.lower().strip()).first()
        if existing:
            return {"success": False, "message": "An account with that email already exists."}
        color = random.choice(AVATAR_COLORS)
        user  = User(
            name          = name.strip(),
            email         = email.lower().strip(),
            password_hash = _hash(password),
            role          = role,
            avatar_color  = color,
        )
        db.add(user)
        db.commit()
        return {"success": True, "message": "Account created successfully.", "user": user.to_dict()}


def update_profile(user_id: int, name: str, bio: str, skills: str) -> dict:
    with get_db() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"success": False, "message": "User not found."}
        user.name   = name.strip()
        user.bio    = bio.strip()
        user.skills = skills.strip()
        db.commit()
        return {"success": True, "user": user.to_dict()}


def change_password(user_id: int, current_pw: str, new_pw: str) -> dict:
    with get_db() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"success": False, "message": "User not found."}
        if not _verify(current_pw, user.password_hash):
            return {"success": False, "message": "Current password is incorrect."}
        user.password_hash = _hash(new_pw)
        db.commit()
        return {"success": True}


def get_all_users() -> list[dict]:
    with get_db() as db:
        return [u.to_dict() for u in db.query(User).filter(User.is_active == True).all()]


def get_user_by_id(user_id: int) -> dict | None:
    with get_db() as db:
        user = db.query(User).filter(User.id == user_id).first()
        return user.to_dict() if user else None


def deactivate_user(user_id: int) -> dict:
    with get_db() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"success": False, "message": "User not found."}
        user.is_active = False
        db.commit()
        return {"success": True}


def promote_user(user_id: int, role: str) -> dict:
    with get_db() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"success": False, "message": "User not found."}
        user.role = role
        db.commit()
        return {"success": True}
