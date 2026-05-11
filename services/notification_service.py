from datetime import datetime
from database.connection import get_db
from database.models import Notification, User


def get_user_notifications(user_id: int, unread_only: bool = False) -> list[dict]:
    with get_db() as db:
        q = db.query(Notification).filter(Notification.user_id == user_id)
        if unread_only:
            q = q.filter(Notification.is_read == False)
        notifs = q.order_by(Notification.created_at.desc()).limit(50).all()
        return [
            {
                "id":         n.id,
                "title":      n.title,
                "message":    n.message,
                "type":       n.notif_type,
                "is_read":    n.is_read,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifs
        ]


def mark_read(notif_id: int) -> None:
    with get_db() as db:
        n = db.query(Notification).filter(Notification.id == notif_id).first()
        if n:
            n.is_read = True
            db.commit()


def mark_all_read(user_id: int) -> None:
    with get_db() as db:
        db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False,
        ).update({"is_read": True})
        db.commit()


def unread_count(user_id: int) -> int:
    with get_db() as db:
        return (
            db.query(Notification)
            .filter(Notification.user_id == user_id, Notification.is_read == False)
            .count()
        )


def broadcast(title: str, message: str, notif_type: str = "info") -> None:
    """Send a notification to every active user."""
    with get_db() as db:
        users = db.query(User).filter(User.is_active == True).all()
        for u in users:
            db.add(Notification(
                user_id    = u.id,
                title      = title,
                message    = message,
                notif_type = notif_type,
            ))
        db.commit()
