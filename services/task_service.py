from datetime import datetime
from database.connection import get_db
from database.models import Task, User, Notification


STATUSES   = ["todo", "in_progress", "review", "done"]
PRIORITIES = ["low", "medium", "high", "urgent"]


def create_task(
    title: str,
    description: str = "",
    priority: str    = "medium",
    assigned_to_id: int | None = None,
    created_by_id: int = 0,
    meeting_id: int | None = None,
    due_date: datetime | None = None,
    tags: str = "",
) -> dict:
    with get_db() as db:
        task = Task(
            title          = title.strip(),
            description    = description.strip(),
            priority       = priority,
            assigned_to_id = assigned_to_id,
            created_by_id  = created_by_id,
            meeting_id     = meeting_id,
            due_date       = due_date,
            tags           = tags.strip(),
            status         = "todo",
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        if assigned_to_id and assigned_to_id != created_by_id:
            notif = Notification(
                user_id    = assigned_to_id,
                title      = "New task assigned to you",
                message    = f'You have been assigned task: "{task.title}".',
                notif_type = "task",
            )
            db.add(notif)
            db.commit()

        return task.to_dict()


def get_all_tasks(status: str | None = None) -> list[dict]:
    with get_db() as db:
        q = db.query(Task)
        if status:
            q = q.filter(Task.status == status)
        tasks = q.order_by(Task.created_at.desc()).all()
        return [t.to_dict() for t in tasks]


def get_tasks_by_user(user_id: int) -> list[dict]:
    with get_db() as db:
        tasks = (
            db.query(Task)
            .filter(Task.assigned_to_id == user_id)
            .order_by(Task.created_at.desc())
            .all()
        )
        return [t.to_dict() for t in tasks]


def get_task(task_id: int) -> dict | None:
    with get_db() as db:
        t = db.query(Task).filter(Task.id == task_id).first()
        return t.to_dict() if t else None


def update_task_status(task_id: int, new_status: str) -> dict:
    with get_db() as db:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return {"success": False, "message": "Task not found."}
        task.status     = new_status
        task.updated_at = datetime.utcnow()
        if new_status == "done":
            task.completed_at = datetime.utcnow()
        else:
            task.completed_at = None
        db.commit()
        return {"success": True, "task": task.to_dict()}


def update_task(task_id: int, **kwargs) -> dict:
    with get_db() as db:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return {"success": False, "message": "Task not found."}
        allowed = {"title", "description", "priority", "assigned_to_id", "due_date", "tags", "status"}
        for k, v in kwargs.items():
            if k in allowed:
                setattr(task, k, v)
        task.updated_at = datetime.utcnow()
        if task.status == "done" and not task.completed_at:
            task.completed_at = datetime.utcnow()
        db.commit()
        return {"success": True, "task": task.to_dict()}


def delete_task(task_id: int) -> dict:
    with get_db() as db:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return {"success": False, "message": "Task not found."}
        db.delete(task)
        db.commit()
        return {"success": True}


def get_overdue_tasks() -> list[dict]:
    now = datetime.utcnow()
    with get_db() as db:
        tasks = (
            db.query(Task)
            .filter(Task.due_date < now, Task.status != "done")
            .order_by(Task.due_date)
            .all()
        )
        return [t.to_dict() for t in tasks]


def get_task_stats() -> dict:
    with get_db() as db:
        all_tasks = db.query(Task).all()
        now = datetime.utcnow()
        stats = {
            "total":       len(all_tasks),
            "todo":        sum(1 for t in all_tasks if t.status == "todo"),
            "in_progress": sum(1 for t in all_tasks if t.status == "in_progress"),
            "review":      sum(1 for t in all_tasks if t.status == "review"),
            "done":        sum(1 for t in all_tasks if t.status == "done"),
            "overdue":     sum(1 for t in all_tasks if t.due_date and t.due_date < now and t.status != "done"),
        }
        stats["completion_rate"] = (
            round(stats["done"] / stats["total"] * 100, 1) if stats["total"] > 0 else 0.0
        )
        return stats


def get_member_stats() -> list[dict]:
    """Return per-member task breakdown."""
    with get_db() as db:
        users = db.query(User).filter(User.is_active == True).all()
        now   = datetime.utcnow()
        result = []
        for u in users:
            tasks = db.query(Task).filter(Task.assigned_to_id == u.id).all()
            result.append({
                "user_id":        u.id,
                "name":           u.name,
                "avatar_color":   u.avatar_color,
                "total":          len(tasks),
                "done":           sum(1 for t in tasks if t.status == "done"),
                "in_progress":    sum(1 for t in tasks if t.status == "in_progress"),
                "overdue":        sum(1 for t in tasks if t.due_date and t.due_date < now and t.status != "done"),
                "completion_rate": round(
                    sum(1 for t in tasks if t.status == "done") / len(tasks) * 100, 1
                ) if tasks else 0.0,
            })
        return result
