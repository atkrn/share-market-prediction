"""
Dashboard — team overview, live metrics, charts & notifications.
"""
import json
import streamlit as st
from datetime import datetime, timedelta

from components.ui_helpers import require_auth, render_sidebar, page_header, due_label, priority_badge, status_badge
from components.charts import (
    task_status_donut, member_performance_bar, task_completion_timeline,
    completion_gauge, burndown_chart,
)
from services.task_service import get_task_stats, get_all_tasks, get_member_stats, get_overdue_tasks
from services.meeting_service import get_all_meetings
from services.auth_service import get_all_users
from services.notification_service import get_user_notifications, mark_all_read, unread_count

st.set_page_config(page_title="Dashboard — TeamSync", page_icon="📊", layout="wide")
user = require_auth()
render_sidebar(user)

# ─────────────────────────────────────────────────────────────
#  Data
# ─────────────────────────────────────────────────────────────
stats        = get_task_stats()
all_tasks    = get_all_tasks()
member_stats = get_member_stats()
meetings     = get_all_meetings()
overdue      = get_overdue_tasks()
all_users    = get_all_users()
notif_count  = unread_count(user["id"])

# ─────────────────────────────────────────────────────────────
#  Header
# ─────────────────────────────────────────────────────────────
page_header(
    f"📊 Dashboard",
    f"Welcome back, {user['name']} · {datetime.now().strftime('%A, %B %d %Y')}",
)

# Notifications banner
if notif_count > 0:
    notifs = get_user_notifications(user["id"], unread_only=True)
    with st.expander(f"🔔 You have **{notif_count}** unread notification{'s' if notif_count > 1 else ''}"):
        for n in notifs[:5]:
            ts = datetime.fromisoformat(n["created_at"]).strftime("%b %d, %H:%M")
            st.markdown(
                f'<div style="padding:8px 0;border-bottom:1px solid #30363d;">'
                f'<b>{n["title"]}</b><br>'
                f'<span style="color:#8b949e;font-size:.82rem;">{n["message"]}</span><br>'
                f'<span style="color:#8b949e;font-size:.72rem;">{ts}</span>'
                f'</div>',
                unsafe_allow_html=True,
            )
        if st.button("Mark all as read"):
            mark_all_read(user["id"])
            st.rerun()

st.divider()

# ─────────────────────────────────────────────────────────────
#  KPI row
# ─────────────────────────────────────────────────────────────
k1, k2, k3, k4, k5, k6 = st.columns(6)
k1.metric("Total Tasks",    stats["total"])
k2.metric("Completed",      stats["done"],        delta=f"{stats['completion_rate']}%")
k3.metric("In Progress",    stats["in_progress"])
k4.metric("In Review",      stats["review"])
k5.metric("Overdue",        stats["overdue"],     delta=f"-{stats['overdue']}" if stats["overdue"] else "0", delta_color="inverse")
k6.metric("Team Members",   len(all_users))

st.divider()

# ─────────────────────────────────────────────────────────────
#  Charts row 1: donut + gauge + member bar
# ─────────────────────────────────────────────────────────────
c_donut, c_gauge, c_bar = st.columns([1, 1, 2])
with c_donut:
    st.plotly_chart(task_status_donut(stats), use_container_width=True)
with c_gauge:
    st.plotly_chart(completion_gauge(stats["completion_rate"]), use_container_width=True)
with c_bar:
    st.plotly_chart(member_performance_bar(member_stats), use_container_width=True)

# ─────────────────────────────────────────────────────────────
#  Charts row 2: timeline + burndown
# ─────────────────────────────────────────────────────────────
c_tl, c_bd = st.columns(2)
with c_tl:
    st.plotly_chart(task_completion_timeline(all_tasks, days=30), use_container_width=True)
with c_bd:
    st.plotly_chart(burndown_chart(all_tasks, days=14), use_container_width=True)

st.divider()

# ─────────────────────────────────────────────────────────────
#  Overdue tasks + Recent meetings
# ─────────────────────────────────────────────────────────────
col_ov, col_meet = st.columns(2)

with col_ov:
    st.markdown("### ⚠️ Overdue Tasks")
    if overdue:
        for t in overdue[:8]:
            due_str = due_label(t.get("due_date"))
            st.markdown(
                f'<div class="ts-card" style="border-left:3px solid #f85149;">'
                f'{priority_badge(t["priority"])} '
                f'<b>{t["title"]}</b><br>'
                f'<span style="color:#8b949e;font-size:.80rem;">Assigned to: {t.get("assignee_name","Unassigned")}</span> '
                f'{due_str}</div>',
                unsafe_allow_html=True,
            )
    else:
        st.success("No overdue tasks! 🎉")

with col_meet:
    st.markdown("### 📅 Recent Meetings")
    if meetings:
        for m in meetings[:5]:
            date_str  = datetime.fromisoformat(m["date"]).strftime("%b %d, %Y") if m["date"] else ""
            sentiment = m.get("sentiment", "neutral")
            s_color   = {"positive": "#3fb950", "neutral": "#8b949e", "concerning": "#f85149"}.get(sentiment, "#8b949e")
            st.markdown(
                f'<div class="ts-card">'
                f'<div style="display:flex;justify-content:space-between;">'
                f'<b>{m["title"]}</b>'
                f'<span style="color:{s_color};font-size:.80rem;">{sentiment}</span>'
                f'</div>'
                f'<div style="color:#8b949e;font-size:.80rem;margin-top:4px;">'
                f'📅 {date_str} · {m["task_count"]} tasks · {m["status"]}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )
    else:
        st.info("No meetings recorded yet.")

st.divider()

# ─────────────────────────────────────────────────────────────
#  Quick task actions
# ─────────────────────────────────────────────────────────────
st.markdown("### ✅ My Tasks")
my_tasks = [t for t in all_tasks if t.get("assigned_to_id") == user["id"] and t["status"] != "done"]
if my_tasks:
    for t in my_tasks[:6]:
        c_title, c_status, c_due = st.columns([4, 1, 1])
        with c_title:
            st.markdown(
                f'{priority_badge(t["priority"])} {t["title"]}',
                unsafe_allow_html=True,
            )
        with c_status:
            st.markdown(status_badge(t["status"]), unsafe_allow_html=True)
        with c_due:
            st.markdown(due_label(t.get("due_date")), unsafe_allow_html=True)
else:
    st.success("No open tasks assigned to you! 🎉")
