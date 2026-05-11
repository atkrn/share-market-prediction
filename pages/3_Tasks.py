"""
Tasks — Kanban board with full CRUD, priority management, and risk analysis.
"""
import streamlit as st
from datetime import datetime, date

from components.ui_helpers import (
    require_auth, render_sidebar, page_header,
    priority_badge, status_badge, due_label, avatar_html,
)
from components.charts import priority_breakdown
from services.task_service import (
    get_all_tasks, create_task, update_task_status, update_task,
    delete_task, get_task_stats, get_overdue_tasks,
)
from services.auth_service import get_all_users
from services.ai_service import predict_risks

st.set_page_config(page_title="Tasks — TeamSync", page_icon="✅", layout="wide")
user = require_auth()
render_sidebar(user)

page_header("✅ Tasks & Kanban Board", "Create, assign, and track all work items")
st.divider()

# ─────────────────────────────────────────────────────────────
#  Data
# ─────────────────────────────────────────────────────────────
all_tasks = get_all_tasks()
all_users = get_all_users()
stats     = get_task_stats()
user_map  = {u["id"]: u for u in all_users}

# ─────────────────────────────────────────────────────────────
#  KPI bar
# ─────────────────────────────────────────────────────────────
k1, k2, k3, k4, k5 = st.columns(5)
k1.metric("Total",       stats["total"])
k2.metric("To Do",       stats["todo"])
k3.metric("In Progress", stats["in_progress"])
k4.metric("Done",        stats["done"],    delta=f"{stats['completion_rate']}%")
k5.metric("Overdue",     stats["overdue"], delta_color="inverse")
st.divider()

# ─────────────────────────────────────────────────────────────
#  Tabs
# ─────────────────────────────────────────────────────────────
tab_board, tab_list, tab_new, tab_risks = st.tabs([
    "🗂 Kanban Board", "📋 List View", "＋ New Task", "⚠️ Risk Analysis"
])

# ═════════════════════════════════════════════════════════════
#  TAB 1 — Kanban Board
# ═════════════════════════════════════════════════════════════
with tab_board:
    # Filters
    f1, f2, f3 = st.columns(3)
    with f1:
        filter_user = st.selectbox(
            "Filter by member",
            ["All"] + [u["name"] for u in all_users],
            key="kb_filter_user",
        )
    with f2:
        filter_priority = st.selectbox(
            "Filter by priority",
            ["All", "urgent", "high", "medium", "low"],
            key="kb_filter_priority",
        )
    with f3:
        search_kw = st.text_input("🔍 Search", placeholder="keyword…", key="kb_search")

    def _filter(tasks):
        out = tasks
        if filter_user != "All":
            out = [t for t in out if t.get("assignee_name") == filter_user]
        if filter_priority != "All":
            out = [t for t in out if t.get("priority") == filter_priority]
        if search_kw:
            out = [t for t in out if search_kw.lower() in t["title"].lower()]
        return out

    COLUMNS = [
        ("todo",        "📌 To Do",      "#8b949e"),
        ("in_progress", "🔵 In Progress","#58a6ff"),
        ("review",      "🟣 In Review",  "#bc8cff"),
        ("done",        "✅ Done",        "#3fb950"),
    ]
    NEXT_STATUS = {
        "todo": "in_progress", "in_progress": "review",
        "review": "done", "done": "todo",
    }
    NEXT_LABEL = {
        "todo": "▶ Start",  "in_progress": "🔍 Review",
        "review": "✅ Done", "done": "↺ Reopen",
    }

    board_cols = st.columns(4)
    for col_ref, (status, label, color) in zip(board_cols, COLUMNS):
        col_tasks = _filter([t for t in all_tasks if t["status"] == status])
        with col_ref:
            st.markdown(
                f'<div class="kanban-header" style="background:rgba(255,255,255,.04);color:{color};">'
                f'{label} <span style="color:#8b949e;">({len(col_tasks)})</span></div>',
                unsafe_allow_html=True,
            )
            for t in col_tasks:
                assignee = user_map.get(t.get("assigned_to_id"))
                av_html  = avatar_html(assignee["name"], assignee["avatar_color"], 22) if assignee else ""
                due      = due_label(t.get("due_date"))
                tags     = t.get("tags", "")
                tag_html = "".join(f'<span class="tag">{tg}</span>' for tg in tags.split(",") if tg.strip())

                with st.container():
                    st.markdown(
                        f'<div class="kanban-card">'
                        f'{priority_badge(t["priority"])} '
                        f'<b style="font-size:.88rem;">{t["title"]}</b><br>'
                        f'<div style="display:flex;align-items:center;gap:6px;margin-top:6px;">'
                        f'{av_html}'
                        f'<span style="color:#8b949e;font-size:.75rem;">{t.get("assignee_name","Unassigned")}</span>'
                        f'</div>'
                        f'<div style="margin-top:4px;">{due} {tag_html}</div>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )
                    btn_col1, btn_col2 = st.columns(2)
                    with btn_col1:
                        if st.button(NEXT_LABEL[status], key=f"move_{t['id']}", use_container_width=True):
                            update_task_status(t["id"], NEXT_STATUS[status])
                            st.rerun()
                    with btn_col2:
                        if st.button("✎", key=f"edit_{t['id']}", use_container_width=True):
                            st.session_state[f"editing_task_{t['id']}"] = True

                # Inline edit form
                if st.session_state.get(f"editing_task_{t['id']}"):
                    with st.form(f"edit_form_{t['id']}"):
                        new_title = st.text_input("Title", value=t["title"])
                        new_desc  = st.text_area("Description", value=t.get("description", ""), height=80)
                        new_prio  = st.selectbox("Priority", ["low","medium","high","urgent"],
                                                 index=["low","medium","high","urgent"].index(t["priority"]))
                        assignee_names = ["Unassigned"] + [u["name"] for u in all_users]
                        cur_assignee   = t.get("assignee_name", "Unassigned")
                        new_assignee   = st.selectbox("Assignee", assignee_names,
                                                      index=assignee_names.index(cur_assignee) if cur_assignee in assignee_names else 0)
                        new_tags       = st.text_input("Tags (comma-separated)", value=t.get("tags", ""))
                        save_btn = st.form_submit_button("Save Changes", type="primary")
                        cancel   = st.form_submit_button("Cancel")

                    if save_btn:
                        assignee_id = next((u["id"] for u in all_users if u["name"] == new_assignee), None)
                        update_task(
                            t["id"],
                            title=new_title,
                            description=new_desc,
                            priority=new_prio,
                            assigned_to_id=assignee_id,
                            tags=new_tags,
                        )
                        st.session_state.pop(f"editing_task_{t['id']}", None)
                        st.rerun()
                    if cancel:
                        st.session_state.pop(f"editing_task_{t['id']}", None)
                        st.rerun()

# ═════════════════════════════════════════════════════════════
#  TAB 2 — List View
# ═════════════════════════════════════════════════════════════
with tab_list:
    st.markdown("### All Tasks")
    col_search, col_sort = st.columns([3, 1])
    with col_search:
        lv_search = st.text_input("🔍 Search tasks", placeholder="title, tag…", key="lv_search")
    with col_sort:
        lv_sort = st.selectbox("Sort by", ["newest", "oldest", "priority", "due_date"], key="lv_sort")

    displayed = [
        t for t in all_tasks
        if not lv_search or lv_search.lower() in t["title"].lower()
    ]
    if lv_sort == "oldest":
        displayed.sort(key=lambda t: t["created_at"] or "")
    elif lv_sort == "priority":
        order = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
        displayed.sort(key=lambda t: order.get(t["priority"], 2))
    elif lv_sort == "due_date":
        displayed.sort(key=lambda t: t.get("due_date") or "9999")

    for t in displayed:
        c_name, c_prio, c_status, c_assignee, c_due, c_del = st.columns([4, 1, 1.2, 1.5, 1.5, 0.5])
        c_name.markdown(f"**{t['title']}**")
        c_prio.markdown(priority_badge(t["priority"]), unsafe_allow_html=True)
        c_status.markdown(status_badge(t["status"]), unsafe_allow_html=True)
        c_assignee.markdown(f'<span style="color:#8b949e;font-size:.80rem;">{t.get("assignee_name","—")}</span>', unsafe_allow_html=True)
        c_due.markdown(due_label(t.get("due_date")), unsafe_allow_html=True)
        if c_del.button("🗑", key=f"del_list_{t['id']}"):
            delete_task(t["id"])
            st.rerun()

# ═════════════════════════════════════════════════════════════
#  TAB 3 — Create New Task
# ═════════════════════════════════════════════════════════════
with tab_new:
    st.markdown("### Create a New Task")
    with st.form("new_task_form"):
        n_title = st.text_input("Task Title*", placeholder="Implement user authentication")
        n_desc  = st.text_area("Description", placeholder="Additional details…", height=100)
        n_c1, n_c2 = st.columns(2)
        with n_c1:
            n_priority  = st.selectbox("Priority",  ["medium", "high", "urgent", "low"])
            n_due_date  = st.date_input("Due Date (optional)", value=None, format="YYYY-MM-DD")
        with n_c2:
            assignee_names = ["Unassigned"] + [u["name"] for u in all_users]
            n_assignee   = st.selectbox("Assign To", assignee_names)
            n_tags       = st.text_input("Tags (comma-separated)", placeholder="backend, api, urgent")

        n_submit = st.form_submit_button("Create Task →", type="primary", use_container_width=True)

    if n_submit:
        if not n_title.strip():
            st.error("Task title is required.")
        else:
            assignee_id = next((u["id"] for u in all_users if u["name"] == n_assignee), None)
            due_dt = datetime.combine(n_due_date, datetime.min.time()) if n_due_date else None
            result = create_task(
                title          = n_title,
                description    = n_desc,
                priority       = n_priority,
                assigned_to_id = assignee_id,
                created_by_id  = user["id"],
                due_date       = due_dt,
                tags           = n_tags,
            )
            st.success(f"Task **{result['title']}** created!")
            st.rerun()

# ═════════════════════════════════════════════════════════════
#  TAB 4 — Risk Analysis
# ═════════════════════════════════════════════════════════════
with tab_risks:
    st.markdown("### ⚠️ AI Risk Analysis")
    st.caption("Claude analyses your task data and predicts potential project delays and risks.")

    col_chart, col_btn = st.columns([2, 1])
    with col_chart:
        st.plotly_chart(priority_breakdown(all_tasks), use_container_width=True)
    with col_btn:
        st.markdown("**Overdue Tasks**")
        overdue = get_overdue_tasks()
        if overdue:
            for t in overdue[:5]:
                st.markdown(
                    f'- {priority_badge(t["priority"])} {t["title"]} '
                    f'<span style="color:#8b949e;font-size:.75rem;">({t.get("assignee_name","—")})</span>',
                    unsafe_allow_html=True,
                )
        else:
            st.success("No overdue tasks!")

        if st.button("🤖 Run Risk Analysis", type="primary", use_container_width=True):
            now = datetime.utcnow()
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
            with st.spinner("🧠 Analysing risks…"):
                risk_report = predict_risks(tasks_for_ai)
            st.session_state["risk_report"] = risk_report

    if "risk_report" in st.session_state:
        st.divider()
        st.markdown(st.session_state["risk_report"])
