"""
Admin Panel — user management, system stats, bulk notifications.
Admin-only page: non-admins are redirected.
"""
import streamlit as st
from datetime import datetime

from components.ui_helpers import require_auth, render_sidebar, page_header, avatar_html
from services.auth_service import get_all_users, deactivate_user, promote_user
from services.task_service import get_task_stats, get_member_stats
from services.meeting_service import get_all_meetings
from services.notification_service import broadcast
from database.connection import get_db
from database.models import User

st.set_page_config(page_title="Admin — TeamSync", page_icon="⚙️", layout="wide")
user = require_auth()
render_sidebar(user)

if user.get("role") != "admin":
    st.error("⛔ Access denied. Admin role required.")
    st.stop()

page_header("⚙️ Admin Panel", "User management, system health, and notifications")
st.divider()

tab_users, tab_system, tab_notifs = st.tabs(["👥 User Management", "📊 System Stats", "🔔 Broadcast Notification"])

# ═════════════════════════════════════════════════════════════
#  TAB 1 — User Management
# ═════════════════════════════════════════════════════════════
with tab_users:
    all_users = get_all_users()
    st.markdown(f"### Users  ({len(all_users)} active)")

    # Table header
    h1, h2, h3, h4, h5, h6 = st.columns([2.5, 2, 1, 1.2, 1.2, 1.2])
    for col_ref, label in zip([h1, h2, h3, h4, h5, h6],
                              ["Name", "Email", "Role", "Joined", "Promote", "Actions"]):
        col_ref.markdown(f'<div style="color:#8b949e;font-size:.78rem;font-weight:600;">{label}</div>',
                         unsafe_allow_html=True)
    st.divider()

    for u in all_users:
        c1, c2, c3, c4, c5, c6 = st.columns([2.5, 2, 1, 1.2, 1.2, 1.2])
        joined = datetime.fromisoformat(u["created_at"]).strftime("%b %d, %Y") if u.get("created_at") else "—"

        with c1:
            st.markdown(
                f'<div style="display:flex;align-items:center;gap:8px;">'
                f'{avatar_html(u["name"], u["avatar_color"], 28)}'
                f'<span style="font-size:.88rem;">{u["name"]}</span></div>',
                unsafe_allow_html=True,
            )
        c2.markdown(f'<span style="color:#8b949e;font-size:.82rem;">{u["email"]}</span>', unsafe_allow_html=True)
        role_color = "#58a6ff" if u["role"] == "admin" else "#3fb950"
        c3.markdown(f'<span style="color:{role_color};font-size:.82rem;">{u["role"]}</span>', unsafe_allow_html=True)
        c4.markdown(f'<span style="color:#8b949e;font-size:.78rem;">{joined}</span>', unsafe_allow_html=True)

        with c5:
            if u["id"] != user["id"]:  # can't demote yourself
                new_role = st.selectbox(
                    "role",
                    ["member", "admin"],
                    index=0 if u["role"] == "member" else 1,
                    key=f"role_{u['id']}",
                    label_visibility="collapsed",
                )
                if st.button("Set", key=f"promote_{u['id']}", use_container_width=True):
                    promote_user(u["id"], new_role)
                    st.rerun()

        with c6:
            if u["id"] != user["id"]:
                if st.button("Deactivate", key=f"deact_{u['id']}", use_container_width=True):
                    deactivate_user(u["id"])
                    st.success(f"{u['name']} deactivated.")
                    st.rerun()

    st.divider()
    st.markdown("### ➕ Add New User")
    with st.form("admin_add_user"):
        a_name  = st.text_input("Full Name")
        a_email = st.text_input("Email")
        a_pw    = st.text_input("Password (min 8 chars)", type="password")
        a_role  = st.selectbox("Role", ["member", "admin"])
        a_sub   = st.form_submit_button("Create User →", type="primary", use_container_width=True)
    if a_sub:
        from services.auth_service import register_user
        if not all([a_name, a_email, a_pw]):
            st.error("All fields required.")
        elif len(a_pw) < 8:
            st.error("Password must be at least 8 characters.")
        else:
            result = register_user(a_name, a_email, a_pw, a_role)
            if result["success"]:
                st.success(f"User '{a_name}' created.")
                st.rerun()
            else:
                st.error(result["message"])

# ═════════════════════════════════════════════════════════════
#  TAB 2 — System Stats
# ═════════════════════════════════════════════════════════════
with tab_system:
    stats         = get_task_stats()
    member_stats  = get_member_stats()
    meetings      = get_all_meetings()
    all_users_raw = get_all_users()

    st.markdown("### 📊 System Overview")
    s1, s2, s3, s4 = st.columns(4)
    s1.metric("Total Users",    len(all_users_raw))
    s2.metric("Total Tasks",    stats["total"])
    s3.metric("Total Meetings", len(meetings))
    s4.metric("Completion Rate", f"{stats['completion_rate']}%")

    st.divider()
    st.markdown("### 🗄 Database Statistics")

    with get_db() as db:
        from database.models import Task, Meeting, Notification, ChatMessage, FileRecord
        db_stats = {
            "Users":         db.query(User).count(),
            "Active Users":  db.query(User).filter(User.is_active == True).count(),
            "Tasks":         db.query(Task).count(),
            "Meetings":      db.query(Meeting).count(),
            "Notifications": db.query(Notification).count(),
            "Chat Messages": db.query(ChatMessage).count(),
            "Files":         db.query(FileRecord).count(),
        }

    for entity, count in db_stats.items():
        col_e, col_c, col_bar = st.columns([2, 1, 4])
        col_e.markdown(entity)
        col_c.markdown(f"**{count}**")
        max_val = max(db_stats.values()) or 1
        pct     = int(count / max_val * 100)
        col_bar.markdown(
            f'<div style="background:#21262d;border-radius:4px;height:8px;margin-top:6px;">'
            f'<div style="width:{pct}%;height:8px;border-radius:4px;background:#58a6ff;"></div></div>',
            unsafe_allow_html=True,
        )

    st.divider()
    st.markdown("### 🗂 Per-Member Workload")
    member_stats_sorted = sorted(member_stats, key=lambda m: m["total"], reverse=True)
    for m in member_stats_sorted:
        mc1, mc2, mc3, mc4 = st.columns([2, 1, 1, 1])
        mc1.markdown(f"**{m['name']}**")
        mc2.markdown(f"📋 {m['total']} tasks")
        mc3.markdown(f"✅ {m['done']} done")
        mc4.markdown(f"⚠️ {m['overdue']} overdue" if m["overdue"] else "🟢 No overdue")

# ═════════════════════════════════════════════════════════════
#  TAB 3 — Broadcast Notification
# ═════════════════════════════════════════════════════════════
with tab_notifs:
    st.markdown("### 🔔 Send Notification to All Team Members")
    with st.form("broadcast_form"):
        b_title   = st.text_input("Notification Title", placeholder="Team Announcement")
        b_message = st.text_area("Message", placeholder="Enter your message here…", height=120)
        b_type    = st.selectbox("Type", ["info", "warning", "success", "error"])
        b_submit  = st.form_submit_button("📢 Send to All Members →", type="primary", use_container_width=True)
    if b_submit:
        if not b_title.strip() or not b_message.strip():
            st.error("Title and message are required.")
        else:
            broadcast(b_title, b_message, b_type)
            st.success(f"Notification sent to all {len(all_users_raw)} active members!")
