"""
AI Assistant — full-context Claude chatbot for project queries.
"""
import streamlit as st
from datetime import datetime

from components.ui_helpers import require_auth, render_sidebar, page_header, avatar_html
from services.ai_service import chat
from services.task_service import get_task_stats, get_overdue_tasks
from services.meeting_service import get_all_meetings
from services.auth_service import get_all_users
from database.connection import get_db
from database.models import ChatMessage

st.set_page_config(page_title="AI Assistant — TeamSync", page_icon="🤖", layout="wide")
user = require_auth()
render_sidebar(user)

page_header("🤖 AI Assistant", "Ask anything about your project — powered by Claude")
st.divider()

# ─────────────────────────────────────────────────────────────
#  Build project context snapshot
# ─────────────────────────────────────────────────────────────
@st.cache_data(ttl=60, show_spinner=False)
def get_context():
    stats    = get_task_stats()
    meetings = get_all_meetings()
    overdue  = get_overdue_tasks()
    users    = get_all_users()
    upcoming = [m for m in meetings if m["status"] == "planned"]
    last_mtg = next((m["title"] for m in meetings if m["status"] == "completed"), "None yet")
    return {
        "team_size":         len(users),
        "total_tasks":       stats["total"],
        "completed_tasks":   stats["done"],
        "in_progress_tasks": stats["in_progress"],
        "overdue_tasks":     stats["overdue"],
        "upcoming_meetings": len(upcoming),
        "last_meeting":      last_mtg,
        "recent_blockers":   ", ".join(
            o["title"] for o in overdue[:3]
        ) or "None",
    }


context = get_context()

# ─────────────────────────────────────────────────────────────
#  Session chat history (in-memory per session + DB persistence)
# ─────────────────────────────────────────────────────────────
if "chat_history" not in st.session_state:
    # Load recent history from DB
    with get_db() as db:
        history = (
            db.query(ChatMessage)
            .filter(ChatMessage.user_id == user["id"])
            .order_by(ChatMessage.created_at.desc())
            .limit(20)
            .all()
        )
        history.reverse()
        st.session_state.chat_history = [
            {"role": h.role, "content": h.content} for h in history
        ]

# ─────────────────────────────────────────────────────────────
#  Layout: chat on left, suggestions + context on right
# ─────────────────────────────────────────────────────────────
col_chat, col_side = st.columns([2, 1])

with col_side:
    # Context snapshot
    st.markdown("**Project Snapshot**")
    st.markdown(
        f'<div class="ts-card">'
        f'<div style="font-size:.82rem;line-height:1.9;">'
        f'👥 {context["team_size"]} team members<br>'
        f'📋 {context["total_tasks"]} total tasks<br>'
        f'✅ {context["completed_tasks"]} completed<br>'
        f'🔵 {context["in_progress_tasks"]} in progress<br>'
        f'⚠️ {context["overdue_tasks"]} overdue<br>'
        f'📅 {context["upcoming_meetings"]} upcoming meetings<br>'
        f'📝 Last meeting: {context["last_meeting"]}'
        f'</div></div>',
        unsafe_allow_html=True,
    )

    st.markdown("**Suggested Questions**")
    suggestions = [
        "What's the current project status?",
        "Who has the most overdue tasks?",
        "What are the top risks this week?",
        "Give me a summary of team performance",
        "What should we prioritise next?",
        "How can we improve our completion rate?",
        "Draft talking points for our next meeting",
        "What blockers should we resolve first?",
    ]
    for suggestion in suggestions:
        if st.button(suggestion, key=f"sug_{suggestion[:20]}", use_container_width=True):
            st.session_state["pending_prompt"] = suggestion

    st.divider()
    if st.button("🗑 Clear Chat History", use_container_width=True):
        st.session_state.chat_history = []
        with get_db() as db:
            db.query(ChatMessage).filter(ChatMessage.user_id == user["id"]).delete()
            db.commit()
        st.rerun()

with col_chat:
    # Render chat messages
    chat_container = st.container()
    with chat_container:
        if not st.session_state.chat_history:
            st.markdown(
                '<div style="text-align:center;padding:40px;color:#8b949e;">'
                '<div style="font-size:2.5rem;margin-bottom:12px;">🤖</div>'
                '<div style="font-weight:600;margin-bottom:8px;">TeamSync AI</div>'
                '<div style="font-size:.85rem;">Ask me anything about your project, team, tasks, or meetings.</div>'
                '</div>',
                unsafe_allow_html=True,
            )
        for msg in st.session_state.chat_history:
            if msg["role"] == "user":
                av = avatar_html(user["name"], user["avatar_color"], 28)
                st.markdown(
                    f'<div style="display:flex;gap:10px;margin-bottom:12px;justify-content:flex-end;">'
                    f'<div style="background:#21262d;border:1px solid #30363d;border-radius:10px 10px 2px 10px;'
                    f'padding:10px 14px;max-width:80%;font-size:.88rem;">{msg["content"]}</div>'
                    f'{av}</div>',
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    f'<div style="display:flex;gap:10px;margin-bottom:12px;">'
                    f'<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);'
                    f'display:flex;align-items:center;justify-content:center;font-size:.70rem;flex-shrink:0;">🤖</div>'
                    f'<div style="background:#161b22;border:1px solid #30363d;border-radius:2px 10px 10px 10px;'
                    f'padding:10px 14px;max-width:80%;font-size:.88rem;">{msg["content"]}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

    # Input box
    prompt = st.chat_input("Ask about tasks, meetings, team performance, risks…")

    # Handle suggestion clicks
    if "pending_prompt" in st.session_state:
        prompt = st.session_state.pop("pending_prompt")

    if prompt:
        st.session_state.chat_history.append({"role": "user", "content": prompt})

        # Persist user message
        with get_db() as db:
            db.add(ChatMessage(user_id=user["id"], role="user", content=prompt))
            db.commit()

        with st.spinner("🧠 Thinking…"):
            response = chat(st.session_state.chat_history, context)

        st.session_state.chat_history.append({"role": "assistant", "content": response})

        # Persist assistant message
        with get_db() as db:
            db.add(ChatMessage(user_id=user["id"], role="assistant", content=response))
            db.commit()

        st.rerun()
