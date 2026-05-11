import json
import os
import uuid
from datetime import datetime
from database.connection import get_db
from database.models import Meeting, Task, Notification, User
from services import ai_service


# ─────────────────────────────────────────────────────────────
#  CRUD
# ─────────────────────────────────────────────────────────────

def create_meeting(title: str, date: datetime, description: str, created_by_id: int) -> dict:
    with get_db() as db:
        meeting = Meeting(
            title          = title.strip(),
            date           = date,
            description    = description.strip(),
            created_by_id  = created_by_id,
            status         = "planned",
        )
        db.add(meeting)
        db.commit()
        db.refresh(meeting)
        return meeting.to_dict()


def get_all_meetings() -> list[dict]:
    with get_db() as db:
        meetings = db.query(Meeting).order_by(Meeting.date.desc()).all()
        result = []
        for m in meetings:
            d = m.to_dict()
            d["creator_name"] = m.creator.name if m.creator else "Unknown"
            d["task_count"]   = len(m.tasks)
            result.append(d)
        return result


def get_meeting(meeting_id: int) -> dict | None:
    with get_db() as db:
        m = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not m:
            return None
        d = m.to_dict()
        d["creator_name"] = m.creator.name if m.creator else "Unknown"
        d["tasks"]        = [t.to_dict() for t in m.tasks]
        return d


def update_meeting_status(meeting_id: int, status: str) -> dict:
    with get_db() as db:
        m = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not m:
            return {"success": False, "message": "Meeting not found."}
        m.status = status
        db.commit()
        return {"success": True}


def delete_meeting(meeting_id: int) -> dict:
    with get_db() as db:
        m = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not m:
            return {"success": False, "message": "Meeting not found."}
        db.delete(m)
        db.commit()
        return {"success": True}


# ─────────────────────────────────────────────────────────────
#  Audio + AI Pipeline
# ─────────────────────────────────────────────────────────────

def save_audio(audio_bytes: bytes, original_name: str) -> str:
    """Save uploaded audio to disk and return the stored filename."""
    os.makedirs("uploads", exist_ok=True)
    ext      = os.path.splitext(original_name)[-1]
    filename = f"{uuid.uuid4().hex}{ext}"
    path     = os.path.join("uploads", filename)
    with open(path, "wb") as f:
        f.write(audio_bytes)
    return filename


def run_ai_pipeline(meeting_id: int, transcript: str) -> dict:
    """
    Given a transcript:
    1. Persist transcript to meeting record
    2. Ask AI for summary, decisions, action items, blockers, next steps
    3. Persist all AI output to meeting record
    4. Auto-create tasks in the DB from AI action items
    5. Send notifications to assignees
    """
    with get_db() as db:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            return {"success": False, "message": "Meeting not found."}

        meeting.transcript = transcript
        meeting.status     = "completed"
        db.commit()

        # Build member list for extraction context
        members = [u.name for u in db.query(User).filter(User.is_active == True).all()]

    # AI call (outside DB session to avoid long-held connections)
    ai_result = ai_service.summarize_meeting(transcript, meeting.title)
    tasks_ai  = ai_service.extract_tasks(transcript, members)

    with get_db() as db:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        meeting.summary       = ai_result.get("summary", "")
        meeting.key_decisions = json.dumps(ai_result.get("key_decisions", []))
        meeting.blockers      = json.dumps(ai_result.get("blockers", []))
        meeting.action_items  = json.dumps(ai_result.get("action_items", []))
        meeting.next_steps    = json.dumps(ai_result.get("next_steps", []))
        meeting.sentiment     = ai_result.get("sentiment", "neutral")
        db.commit()

        # Auto-create tasks
        created_tasks = []
        for item in tasks_ai:
            # Try to find assignee by name
            assignee_id = None
            if item.get("assignee") and item["assignee"] != "Unassigned":
                user = db.query(User).filter(
                    User.name.ilike(f"%{item['assignee']}%")
                ).first()
                if user:
                    assignee_id = user.id

            # Parse due date (best-effort)
            due = None
            if item.get("due_date"):
                try:
                    due = datetime.fromisoformat(item["due_date"])
                except (ValueError, TypeError):
                    pass  # keep None if not parseable

            task = Task(
                title          = item.get("title", "Untitled task"),
                description    = item.get("description", ""),
                status         = "todo",
                priority       = item.get("priority", "medium"),
                assigned_to_id = assignee_id,
                created_by_id  = meeting.created_by_id,
                meeting_id     = meeting_id,
                due_date       = due,
                tags           = ",".join(item.get("tags", [])),
            )
            db.add(task)
            created_tasks.append(item.get("title", ""))

            # Notify assignee
            if assignee_id:
                notif = Notification(
                    user_id    = assignee_id,
                    title      = "New task assigned",
                    message    = f"You have been assigned: \"{task.title}\" from meeting \"{meeting.title}\".",
                    notif_type = "task",
                )
                db.add(notif)

        db.commit()

    return {
        "success":       True,
        "summary":       ai_result.get("summary", ""),
        "action_items":  ai_result.get("action_items", []),
        "key_decisions": ai_result.get("key_decisions", []),
        "blockers":      ai_result.get("blockers", []),
        "next_steps":    ai_result.get("next_steps", []),
        "sentiment":     ai_result.get("sentiment", "neutral"),
        "tasks_created": len(created_tasks),
        "tasks":         created_tasks,
    }
