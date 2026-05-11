"""
TeamSync — AI-Powered Team Project Management Platform
Entry point: Login / Register
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import streamlit as st
from database.connection import init_db
from services.auth_service import authenticate_user, register_user
from components.ui_helpers import inject_custom_css, render_logo

# ─────────────────────────────────────────────────────────────
#  Bootstrap
# ─────────────────────────────────────────────────────────────
init_db()

st.set_page_config(
    page_title = "TeamSync — AI Project Manager",
    page_icon  = "🚀",
    layout     = "wide",
    initial_sidebar_state = "collapsed",
)
inject_custom_css()

# ─────────────────────────────────────────────────────────────
#  If already authenticated → show home panel
# ─────────────────────────────────────────────────────────────
if st.session_state.get("authenticated"):
    user = st.session_state.user
    st.markdown(f"## 👋 Welcome back, **{user['name']}**!")
    st.caption("Your AI-powered project hub is ready.")
    st.divider()

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        if st.button("📊  Dashboard",    use_container_width=True, type="primary"):
            st.switch_page("pages/1_Dashboard.py")
    with c2:
        if st.button("📅  Meetings",     use_container_width=True):
            st.switch_page("pages/2_Meetings.py")
    with c3:
        if st.button("✅  Tasks",        use_container_width=True):
            st.switch_page("pages/3_Tasks.py")
    with c4:
        if st.button("🤖  AI Assistant", use_container_width=True):
            st.switch_page("pages/6_AI_Assistant.py")

    st.divider()
    if st.button("🚪  Sign Out"):
        for k in ["authenticated", "user", "chat_history"]:
            st.session_state.pop(k, None)
        st.rerun()
    st.stop()

# ─────────────────────────────────────────────────────────────
#  Auth pages
# ─────────────────────────────────────────────────────────────
_, col, _ = st.columns([1, 1.6, 1])

with col:
    render_logo()
    st.markdown("<br>", unsafe_allow_html=True)

    tab_login, tab_register = st.tabs(["Sign In", "Create Account"])

    # ── Login ─────────────────────────────────────────────────
    with tab_login:
        with st.form("login_form", clear_on_submit=False):
            email    = st.text_input("Email address", placeholder="you@example.com")
            password = st.text_input("Password", type="password", placeholder="••••••••")
            submit   = st.form_submit_button("Sign In →", use_container_width=True, type="primary")

        if submit:
            if not email or not password:
                st.error("Please fill in both fields.")
            else:
                user = authenticate_user(email, password)
                if user:
                    st.session_state.authenticated = True
                    st.session_state.user          = user
                    st.rerun()
                else:
                    st.error("Invalid email or password.")

        st.markdown(
            '<p style="color:#8b949e;font-size:.78rem;text-align:center;margin-top:8px;">'
            'Default admin: <code>admin@teamsync.ai</code> / <code>admin1234</code></p>',
            unsafe_allow_html=True,
        )

    # ── Register ──────────────────────────────────────────────
    with tab_register:
        with st.form("register_form", clear_on_submit=False):
            r_name   = st.text_input("Full Name",        placeholder="Jane Doe")
            r_email  = st.text_input("Email",            placeholder="jane@example.com")
            r_pw     = st.text_input("Password",         type="password", placeholder="Min 8 characters")
            r_pw2    = st.text_input("Confirm Password", type="password")
            r_role   = st.selectbox("Role", ["member", "admin"])
            r_submit = st.form_submit_button("Create Account →", use_container_width=True, type="primary")

        if r_submit:
            if not all([r_name, r_email, r_pw, r_pw2]):
                st.error("Please fill in all fields.")
            elif r_pw != r_pw2:
                st.error("Passwords don't match.")
            elif len(r_pw) < 8:
                st.error("Password must be at least 8 characters.")
            else:
                result = register_user(r_name, r_email, r_pw, r_role)
                if result["success"]:
                    st.success("Account created! Switch to Sign In to continue.")
                else:
                    st.error(result["message"])

# ── Feature highlights ─────────────────────────────────────────
st.markdown("<br>", unsafe_allow_html=True)
st.divider()
f1, f2, f3, f4 = st.columns(4)
features = [
    ("🤖", "AI Meeting Summaries", "Upload audio → get instant transcript, summary & auto-assigned tasks"),
    ("📊", "Live Analytics",       "Real-time dashboards, heatmaps, burndown charts & risk predictions"),
    ("✅", "Kanban Board",          "Drag-style task management with priorities, deadlines & reminders"),
    ("💬", "AI Chat Assistant",     "Ask anything about your project — Claude answers with full context"),
]
for col_ref, (icon, title, desc) in zip([f1, f2, f3, f4], features):
    with col_ref:
        st.markdown(
            f'<div class="ts-card" style="text-align:center;">'
            f'<div style="font-size:2rem;margin-bottom:8px;">{icon}</div>'
            f'<div style="font-weight:600;margin-bottom:6px;">{title}</div>'
            f'<div style="font-size:.80rem;color:#8b949e;">{desc}</div>'
            f'</div>',
            unsafe_allow_html=True,
        )
