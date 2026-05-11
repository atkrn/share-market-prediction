"""
Analytics — deep-dive charts, weekly reports, and AI risk predictions.
"""
import json
import streamlit as st
from datetime import datetime, timedelta

from components.ui_helpers import require_auth, render_sidebar, page_header
from components.charts import (
    task_completion_timeline, member_performance_bar,
    meeting_frequency, productivity_heatmap,
    burndown_chart, priority_breakdown, completion_gauge,
)
from services.task_service import get_all_tasks, get_task_stats, get_member_stats
from services.meeting_service import get_all_meetings
from services.auth_service import get_all_users
from services.ai_service import generate_weekly_report, predict_risks

st.set_page_config(page_title="Analytics — TeamSync", page_icon="📈", layout="wide")
user = require_auth()
render_sidebar(user)

page_header("📈 Analytics & Reports", "Deep-dive into project health, velocity, and team performance")
st.divider()

# ─────────────────────────────────────────────────────────────
#  Data
# ─────────────────────────────────────────────────────────────
all_tasks    = get_all_tasks()
stats        = get_task_stats()
member_stats = get_member_stats()
meetings     = get_all_meetings()
all_users    = get_all_users()
now          = datetime.utcnow()

tab_overview, tab_members, tab_reports, tab_risk = st.tabs([
    "📊 Overview", "👥 Team Performance", "📋 Weekly Reports", "⚠️ Risk Prediction"
])

# ═════════════════════════════════════════════════════════════
#  TAB 1 — Overview
# ═════════════════════════════════════════════════════════════
with tab_overview:
    # KPIs
    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Total Tasks",        stats["total"])
    k2.metric("Completion Rate",    f"{stats['completion_rate']}%")
    k3.metric("Overdue Tasks",      stats["overdue"], delta_color="inverse")
    k4.metric("Meetings Recorded",  len(meetings))
    st.divider()

    # Row 1
    c1, c2 = st.columns([1.5, 1])
    with c1:
        st.plotly_chart(task_completion_timeline(all_tasks, days=30), use_container_width=True)
    with c2:
        st.plotly_chart(completion_gauge(stats["completion_rate"]), use_container_width=True)

    # Row 2
    c3, c4 = st.columns(2)
    with c3:
        st.plotly_chart(priority_breakdown(all_tasks), use_container_width=True)
    with c4:
        st.plotly_chart(meeting_frequency(meetings, months=3), use_container_width=True)

    # Row 3
    c5, c6 = st.columns(2)
    with c5:
        days_option = st.selectbox("Burndown window", [7, 14, 30], index=1, key="bd_days")
        st.plotly_chart(burndown_chart(all_tasks, days=days_option), use_container_width=True)
    with c6:
        st.plotly_chart(productivity_heatmap(all_tasks), use_container_width=True)

# ═════════════════════════════════════════════════════════════
#  TAB 2 — Team Performance
# ═════════════════════════════════════════════════════════════
with tab_members:
    st.plotly_chart(member_performance_bar(member_stats), use_container_width=True)
    st.divider()

    # Leaderboard
    st.markdown("### 🏆 Leaderboard")
    sorted_members = sorted(member_stats, key=lambda m: m["completion_rate"], reverse=True)
    for rank, m in enumerate(sorted_members, 1):
        medal = ["🥇", "🥈", "🥉"][rank - 1] if rank <= 3 else f"#{rank}"
        pct   = m["completion_rate"]
        bar_c = "#3fb950" if pct >= 70 else ("#d29922" if pct >= 40 else "#f85149")
        st.markdown(
            f'<div class="ts-card" style="display:flex;align-items:center;gap:16px;">'
            f'<div style="font-size:1.4rem;width:36px;text-align:center;">{medal}</div>'
            f'<div style="flex:1;">'
            f'<div style="font-weight:600;">{m["name"]}</div>'
            f'<div style="background:#21262d;border-radius:4px;height:6px;margin-top:4px;">'
            f'<div style="width:{pct:.0f}%;height:6px;border-radius:4px;background:{bar_c};"></div>'
            f'</div></div>'
            f'<div style="text-align:right;min-width:90px;">'
            f'<div style="font-weight:700;color:{bar_c};">{pct:.0f}%</div>'
            f'<div style="color:#8b949e;font-size:.75rem;">{m["done"]}/{m["total"]} tasks</div>'
            f'</div></div>',
            unsafe_allow_html=True,
        )

    st.divider()
    # Per-member timeline
    st.markdown("### 🔍 Member Spotlight")
    selected_member = st.selectbox("Select member", [m["name"] for m in all_users])
    selected_user   = next((u for u in all_users if u["name"] == selected_member), None)
    if selected_user:
        from services.task_service import get_tasks_by_user
        from components.charts import member_radar
        m_tasks = get_tasks_by_user(selected_user["id"])
        m_stat  = next((m for m in member_stats if m["user_id"] == selected_user["id"]), {})
        col_r, col_t = st.columns([1, 2])
        with col_r:
            st.plotly_chart(member_radar(m_stat), use_container_width=True)
        with col_t:
            st.plotly_chart(task_completion_timeline(m_tasks, days=30), use_container_width=True)

# ═════════════════════════════════════════════════════════════
#  TAB 3 — Weekly Reports
# ═════════════════════════════════════════════════════════════
with tab_reports:
    st.markdown("### 📋 AI Weekly Report Generator")
    st.caption("Claude generates a comprehensive report from this week's data.")

    week_start = now - timedelta(days=now.weekday())
    week_end   = week_start + timedelta(days=6)

    completed_week = [
        t for t in all_tasks
        if t.get("completed_at")
        and datetime.fromisoformat(t["completed_at"]) >= week_start
    ]
    active_members = [
        m for m in member_stats
        if m["in_progress"] > 0 or m["done"] > 0
    ]
    top_performers = sorted(
        member_stats, key=lambda m: m["completion_rate"], reverse=True
    )[:3]
    pending_by_member = {
        m["name"]: m["total"] - m["done"]
        for m in member_stats
        if (m["total"] - m["done"]) > 0
    }
    blockers_raw = []
    for mtg in meetings[-3:]:
        if mtg.get("blockers"):
            try:
                blockers_raw.extend(json.loads(mtg["blockers"]))
            except Exception:
                pass

    report_data = {
        "week":              f'{week_start.strftime("%b %d")} – {week_end.strftime("%b %d, %Y")}',
        "team_size":         len(all_users),
        "total_tasks":       stats["total"],
        "completed_tasks":   stats["done"],
        "in_progress_tasks": stats["in_progress"],
        "overdue_tasks":     stats["overdue"],
        "meetings":          len([m for m in meetings if m.get("status") == "completed"]),
        "completion_rate":   stats["completion_rate"],
        "top_performers":    [{"name": m["name"], "rate": m["completion_rate"]} for m in top_performers],
        "pending_by_member": pending_by_member,
        "blockers":          blockers_raw[:5],
    }

    # Preview stats
    col_s1, col_s2, col_s3 = st.columns(3)
    col_s1.metric("Completed This Week", len(completed_week))
    col_s2.metric("Active Members",      len(active_members))
    col_s3.metric("Open Blockers",       len(blockers_raw))

    if st.button("🤖 Generate Weekly Report", type="primary", use_container_width=True):
        with st.spinner("🧠 Generating report…"):
            report = generate_weekly_report(report_data)
        st.session_state["weekly_report"] = report

    if "weekly_report" in st.session_state:
        st.divider()
        st.markdown(st.session_state["weekly_report"])

# ═════════════════════════════════════════════════════════════
#  TAB 4 — Risk Prediction
# ═════════════════════════════════════════════════════════════
with tab_risk:
    st.markdown("### ⚠️ AI Risk Prediction")
    st.caption("Claude analyses overdue tasks, blocked work, and team velocity to surface project risks.")

    overdue_tasks = [t for t in all_tasks if t.get("due_date") and
                     datetime.fromisoformat(t["due_date"]) < now and t["status"] != "done"]
    high_tasks    = [t for t in all_tasks if t["priority"] in ("high", "urgent") and t["status"] != "done"]

    r1, r2, r3 = st.columns(3)
    r1.metric("Overdue Tasks",     len(overdue_tasks), delta_color="inverse")
    r2.metric("High/Urgent Open",  len(high_tasks))
    r3.metric("Avg Completion",    f"{stats['completion_rate']:.0f}%")

    if st.button("🤖 Run Risk Analysis", type="primary", use_container_width=True):
        tasks_for_ai = [
            {
                "title":       t["title"],
                "status":      t["status"],
                "priority":    t["priority"],
                "assignee":    t.get("assignee_name", "Unassigned"),
                "due_date":    t.get("due_date"),
                "days_overdue": max(0, (now - datetime.fromisoformat(t["due_date"])).days)
                               if t.get("due_date") and datetime.fromisoformat(t["due_date"]) < now
                               else 0,
            }
            for t in all_tasks
        ]
        with st.spinner("🧠 Analysing project risks…"):
            risk_md = predict_risks(tasks_for_ai)
        st.session_state["risk_analysis"] = risk_md

    if "risk_analysis" in st.session_state:
        st.divider()
        st.markdown(st.session_state["risk_analysis"])
