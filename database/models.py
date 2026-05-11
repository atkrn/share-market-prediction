from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, Float, ForeignKey
)
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

AVATAR_COLORS = [
    "#667eea", "#764ba2", "#f093fb", "#f5576c",
    "#4facfe", "#43e97b", "#fa709a", "#fee140",
    "#30cfd0", "#a18cd1", "#ffecd2", "#a8edea",
]


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(100), nullable=False)
    email         = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(20), default="member")  # admin | member | viewer
    avatar_color  = Column(String(10), default="#667eea")
    bio           = Column(Text, default="")
    skills        = Column(Text, default="")  # comma-separated
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

    assigned_tasks  = relationship("Task", foreign_keys="Task.assigned_to_id",  back_populates="assignee")
    created_tasks   = relationship("Task", foreign_keys="Task.created_by_id",   back_populates="creator")
    notifications   = relationship("Notification", back_populates="user",       cascade="all, delete-orphan")
    chat_history    = relationship("ChatMessage",  back_populates="user",       cascade="all, delete-orphan")
    uploaded_files  = relationship("FileRecord",   back_populates="uploader")

    def to_dict(self):
        return {
            "id":           self.id,
            "name":         self.name,
            "email":        self.email,
            "role":         self.role,
            "avatar_color": self.avatar_color,
            "bio":          self.bio,
            "skills":       self.skills,
            "is_active":    self.is_active,
            "created_at":   self.created_at.isoformat() if self.created_at else None,
        }


class Meeting(Base):
    __tablename__ = "meetings"

    id              = Column(Integer, primary_key=True, index=True)
    title           = Column(String(200), nullable=False)
    date            = Column(DateTime, nullable=False)
    description     = Column(Text, default="")
    transcript      = Column(Text, default="")
    summary         = Column(Text, default="")
    key_decisions   = Column(Text, default="")   # JSON list stored as string
    blockers        = Column(Text, default="")   # JSON list stored as string
    action_items    = Column(Text, default="")   # JSON list stored as string
    next_steps      = Column(Text, default="")   # JSON list stored as string
    sentiment       = Column(String(20), default="neutral")
    audio_filename  = Column(String(255), default="")
    status          = Column(String(20), default="planned")  # planned|completed|cancelled
    created_by_id   = Column(Integer, ForeignKey("users.id"))
    created_at      = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User", foreign_keys=[created_by_id])
    tasks   = relationship("Task", back_populates="meeting")
    files   = relationship("FileRecord", back_populates="meeting")

    def to_dict(self):
        return {
            "id":             self.id,
            "title":          self.title,
            "date":           self.date.isoformat() if self.date else None,
            "description":    self.description,
            "transcript":     self.transcript,
            "summary":        self.summary,
            "key_decisions":  self.key_decisions,
            "blockers":       self.blockers,
            "action_items":   self.action_items,
            "next_steps":     self.next_steps,
            "sentiment":      self.sentiment,
            "audio_filename": self.audio_filename,
            "status":         self.status,
            "created_by_id":  self.created_by_id,
            "created_at":     self.created_at.isoformat() if self.created_at else None,
        }


class Task(Base):
    __tablename__ = "tasks"

    id             = Column(Integer, primary_key=True, index=True)
    title          = Column(String(300), nullable=False)
    description    = Column(Text, default="")
    status         = Column(String(20), default="todo")     # todo|in_progress|review|done
    priority       = Column(String(20), default="medium")   # low|medium|high|urgent
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_id  = Column(Integer, ForeignKey("users.id"))
    meeting_id     = Column(Integer, ForeignKey("meetings.id"), nullable=True)
    due_date       = Column(DateTime, nullable=True)
    completed_at   = Column(DateTime, nullable=True)
    tags           = Column(String(500), default="")  # comma-separated
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignee = relationship("User",    foreign_keys=[assigned_to_id], back_populates="assigned_tasks")
    creator  = relationship("User",    foreign_keys=[created_by_id],  back_populates="created_tasks")
    meeting  = relationship("Meeting", back_populates="tasks")
    files    = relationship("FileRecord", back_populates="task")

    def to_dict(self):
        return {
            "id":             self.id,
            "title":          self.title,
            "description":    self.description,
            "status":         self.status,
            "priority":       self.priority,
            "assigned_to_id": self.assigned_to_id,
            "assignee_name":  self.assignee.name if self.assignee else "Unassigned",
            "meeting_id":     self.meeting_id,
            "due_date":       self.due_date.isoformat() if self.due_date else None,
            "completed_at":   self.completed_at.isoformat() if self.completed_at else None,
            "tags":           self.tags,
            "created_at":     self.created_at.isoformat() if self.created_at else None,
        }


class Notification(Base):
    __tablename__ = "notifications"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"))
    title      = Column(String(200))
    message    = Column(Text)
    notif_type = Column(String(50), default="info")  # info|warning|success|error|task|meeting
    is_read    = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"

    id         = Column(Integer, primary_key=True, index=True)
    week_start = Column(DateTime)
    week_end   = Column(DateTime)
    content    = Column(Text, default="")
    stats      = Column(Text, default="")  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)


class FileRecord(Base):
    __tablename__ = "files"

    id            = Column(Integer, primary_key=True, index=True)
    filename      = Column(String(255))
    original_name = Column(String(255))
    file_path     = Column(String(500))
    file_type     = Column(String(50))
    file_size     = Column(Integer)
    meeting_id    = Column(Integer, ForeignKey("meetings.id"), nullable=True)
    task_id       = Column(Integer, ForeignKey("tasks.id"),    nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"))
    created_at    = Column(DateTime, default=datetime.utcnow)

    uploader = relationship("User",    back_populates="uploaded_files")
    meeting  = relationship("Meeting", back_populates="files")
    task     = relationship("Task",    back_populates="files")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"))
    role       = Column(String(20))   # user | assistant
    content    = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="chat_history")
