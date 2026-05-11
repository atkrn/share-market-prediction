"""
Members — team directory, per-member task stats, profile editing.
"""
import streamlit as st

from components.ui_helpers import (
    require_auth, render_sidebar, page_header, avatar_html,
    priority_badge, status_badge, due_label,
)
from components.charts import member_radar, member_performance_bar
from services.auth_service import get_all_users, update_profile, change_password
from services.task_service import get_tasks_by_user, get_member_stats

st.set_page_config(page_title="Members — TeamSync", page_icon="👥", layout="wide")
user = require_auth()
render_sidebar(user)

page_header("👥 Team Members", "Profiles, performance metrics & task assignments")
st.divider()

tab_dir, tab_profile = st.tabs(["Team Directory", "✏️ My Profile"])

# ═════════════════════════════════════════════════════════════
#  TAB 1 — Directory
# ═════════════════════════════════════════════════════════════
with tab_dir:
    all_users    = get_all_users()
    member_stats = {m["user_id"]: m for m in get_member_stats()}

    # Summary bar chart
    st.plotly_chart(member_performance_bar(list(member_stats.values())), use_container_width=True)
    st.divider()

    # Member cards
    num_cols = 3
    rows = [all_users[i:i+num_cols] for i in range(0, len(all_users), num_cols)]
    for row in rows:
        cols = st.columns(num_cols)
        for col_ref, u in zip(cols, row):
            stats = member_stats.get(u["id"], {
                "total": 0, "done": 0, "in_progress": 0,
                "overdue": 0, "completion_rate": 0.0,
            })
            with col_ref:
                completion_pct = stats["completion_rate"]
                bar_color = "#3fb950" if completion_pct >= 70 else ("#d29922" if completion_pct >= 40 else "#f85149")
                skills_list = [s.strip() for s in (u.get("skills") or "").split(",") if s.strip()]
                skills_html = " ".join(f'<span class="tag">{s}</span>' for s in skills_list[:4])
                st.markdown(
                    f'<div class="ts-card">'
                    f'<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">'
                    f'{avatar_html(u["name"], u["avatar_color"], 44)}'
                    f'<div><div style="font-weight:600;">{u["name"]}</div>'
                    f'<div style="color:#8b949e;font-size:.78rem;">{u["role"].capitalize()}</div>'
                    f'</div></div>'
                    f'<div style="color:#8b949e;font-size:.80rem;margin-bottom:8px;">{u.get("bio","") or "No bio yet."}</div>'
                    f'<div style="margin-bottom:8px;">{skills_html}</div>'
                    f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.80rem;">'
                    f'<div>📋 {stats["total"]} tasks</div>'
                    f'<div>✅ {stats["done"]} done</div>'
                    f'<div>🔵 {stats["in_progress"]} active</div>'
                    f'<div style="color:#f85149;">⚠️ {stats["overdue"]} overdue</div>'
                    f'</div>'
                    f'<div style="margin-top:10px;background:#21262d;border-radius:4px;height:6px;">'
                    f'<div style="width:{completion_pct:.0f}%;height:6px;border-radius:4px;background:{bar_color};"></div>'
                    f'</div>'
                    f'<div style="font-size:.72rem;color:#8b949e;text-align:right;">{completion_pct:.0f}% complete</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
                with st.expander("View Tasks"):
                    tasks = get_tasks_by_user(u["id"])
                    if tasks:
                        for t in tasks[:8]:
                            st.markdown(
                                f'{priority_badge(t["priority"])} '
                                f'{status_badge(t["status"])} '
                                f'**{t["title"]}** {due_label(t.get("due_date"))}',
                                unsafe_allow_html=True,
                            )
                    else:
                        st.info("No tasks assigned.")

                # Radar chart
                with st.expander("Performance Radar"):
                    st.plotly_chart(member_radar(stats), use_container_width=True)

# ═════════════════════════════════════════════════════════════
#  TAB 2 — My Profile
# ═════════════════════════════════════════════════════════════
with tab_profile:
    st.markdown("### Edit Your Profile")
    c_form, c_preview = st.columns([1, 1])

    with c_form:
        with st.form("profile_form"):
            p_name   = st.text_input("Full Name",  value=user["name"])
            p_bio    = st.text_area("Bio",         value=user.get("bio", ""),    height=100, placeholder="Tell your team about yourself…")
            p_skills = st.text_input("Skills (comma-separated)", value=user.get("skills", ""), placeholder="Python, React, Data Analysis…")
            saved    = st.form_submit_button("Save Profile →", type="primary", use_container_width=True)

        if saved:
            result = update_profile(user["id"], p_name, p_bio, p_skills)
            if result["success"]:
                st.session_state.user = result["user"]
                st.success("Profile updated!")
                st.rerun()
            else:
                st.error(result["message"])

        st.divider()
        st.markdown("### Change Password")
        with st.form("pw_form"):
            cur_pw  = st.text_input("Current Password", type="password")
            new_pw  = st.text_input("New Password",     type="password")
            new_pw2 = st.text_input("Confirm New Password", type="password")
            pw_save = st.form_submit_button("Change Password →", use_container_width=True)

        if pw_save:
            if not all([cur_pw, new_pw, new_pw2]):
                st.error("Please fill in all password fields.")
            elif new_pw != new_pw2:
                st.error("New passwords don't match.")
            elif len(new_pw) < 8:
                st.error("Password must be at least 8 characters.")
            else:
                from services.auth_service import change_password
                result = change_password(user["id"], cur_pw, new_pw)
                if result["success"]:
                    st.success("Password changed successfully!")
                else:
                    st.error(result["message"])

    with c_preview:
        st.markdown("### Profile Preview")
        skills_list = [s.strip() for s in (user.get("skills") or "").split(",") if s.strip()]
        skills_html = " ".join(f'<span class="tag">{s}</span>' for s in skills_list)
        my_stats = next(
            (m for m in get_member_stats() if m["user_id"] == user["id"]),
            {"total": 0, "done": 0, "in_progress": 0, "overdue": 0, "completion_rate": 0.0},
        )
        completion_pct = my_stats["completion_rate"]
        bar_color = "#3fb950" if completion_pct >= 70 else ("#d29922" if completion_pct >= 40 else "#f85149")

        st.markdown(
            f'<div class="ts-card" style="text-align:center;padding:24px;">'
            f'{avatar_html(user["name"], user["avatar_color"], 64)}'
            f'<div style="margin-top:12px;font-size:1.1rem;font-weight:700;">{user["name"]}</div>'
            f'<div style="color:#8b949e;font-size:.82rem;">{user["role"].capitalize()} · {user["email"]}</div>'
            f'<div style="color:#a0aec0;font-size:.83rem;margin:10px 0;">{user.get("bio","") or "No bio yet."}</div>'
            f'<div style="margin:8px 0;">{skills_html}</div>'
            f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.82rem;text-align:left;margin-top:12px;">'
            f'<div>📋 {my_stats["total"]} assigned</div>'
            f'<div>✅ {my_stats["done"]} completed</div>'
            f'<div>🔵 {my_stats["in_progress"]} in progress</div>'
            f'<div style="color:#f85149;">⚠️ {my_stats["overdue"]} overdue</div>'
            f'</div>'
            f'<div style="background:#21262d;border-radius:4px;height:8px;margin-top:12px;">'
            f'<div style="width:{completion_pct:.0f}%;height:8px;border-radius:4px;background:{bar_color};"></div>'
            f'</div>'
            f'<div style="font-size:.75rem;color:#8b949e;text-align:right;margin-top:4px;">{completion_pct:.0f}% completion rate</div>'
            f'</div>',
            unsafe_allow_html=True,
        )
        st.plotly_chart(member_radar(my_stats), use_container_width=True)
