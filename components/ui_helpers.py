"""
Shared CSS injection and reusable UI building blocks for every page.
"""
import streamlit as st
from datetime import datetime


# ─────────────────────────────────────────────────────────────
#  Global CSS  (dark-first, automatic light-mode override)
# ─────────────────────────────────────────────────────────────

CUSTOM_CSS = """
<style>
/* ── Google Fonts ─────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

/* ── Root palette ─────────────────────────────────────────── */
:root {
    --bg:           #0d1117;
    --bg2:          #161b22;
    --bg3:          #21262d;
    --border:       #30363d;
    --text:         #e6edf3;
    --text2:        #8b949e;
    --blue:         #58a6ff;
    --green:        #3fb950;
    --yellow:       #d29922;
    --red:          #f85149;
    --purple:       #bc8cff;
    --orange:       #f0883e;
    --radius:       10px;
    --shadow:       0 2px 12px rgba(0,0,0,.35);
}

/* ── Base ──────────────────────────────────────────────────── */
html, body, [data-testid="stAppViewContainer"] {
    background-color: var(--bg) !important;
    color: var(--text) !important;
    font-family: 'Inter', sans-serif !important;
}
[data-testid="stSidebar"] {
    background-color: var(--bg2) !important;
    border-right: 1px solid var(--border) !important;
}
.block-container { padding-top: 1.2rem !important; padding-bottom: 2rem !important; }

/* ── Cards ─────────────────────────────────────────────────── */
.ts-card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px 20px;
    margin-bottom: 12px;
    box-shadow: var(--shadow);
}
.ts-card:hover { border-color: var(--blue); transition: border-color .2s; }

/* ── Metrics ────────────────────────────────────────────────── */
.ts-metric {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px 20px;
    text-align: center;
}
.ts-metric .value { font-size: 2rem; font-weight: 700; color: var(--text); }
.ts-metric .label { font-size: 0.78rem; color: var(--text2); margin-top: 4px; }
.ts-metric .delta { font-size: 0.82rem; margin-top: 6px; }

/* ── Kanban columns ─────────────────────────────────────────── */
.kanban-col {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
    min-height: 420px;
}
.kanban-header {
    font-size: 0.82rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .06em;
    padding: 6px 8px;
    border-radius: 6px;
    margin-bottom: 10px;
    text-align: center;
}
.kanban-card {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 8px;
    cursor: pointer;
}
.kanban-card:hover { border-color: var(--blue); }

/* ── Priority badges ────────────────────────────────────────── */
.badge {
    display: inline-block;
    font-size: 0.70rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: .04em;
}
.badge-urgent  { background: rgba(248,81,73,.18);  color: #f85149; }
.badge-high    { background: rgba(240,136,62,.18); color: #f0883e; }
.badge-medium  { background: rgba(210,153,34,.18); color: #d29922; }
.badge-low     { background: rgba(63,185,80,.18);  color: #3fb950; }

/* ── Status badges ──────────────────────────────────────────── */
.status-todo        { background: rgba(139,148,158,.18); color: #8b949e; }
.status-in_progress { background: rgba(88,166,255,.18);  color: #58a6ff; }
.status-review      { background: rgba(188,140,255,.18); color: #bc8cff; }
.status-done        { background: rgba(63,185,80,.18);   color: #3fb950; }

/* ── Avatar ─────────────────────────────────────────────────── */
.avatar {
    width: 36px; height: 36px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 0.85rem;
    color: #fff;
    flex-shrink: 0;
}

/* ── Tags ───────────────────────────────────────────────────── */
.tag {
    display: inline-block;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 0.70rem;
    padding: 1px 6px;
    margin-right: 4px;
    color: var(--text2);
}

/* ── Sentiment colours ──────────────────────────────────────── */
.sentiment-positive  { color: #3fb950; }
.sentiment-neutral   { color: #8b949e; }
.sentiment-concerning { color: #f85149; }

/* ── Section header ─────────────────────────────────────────── */
.section-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 0.6rem;
}
.section-sub {
    font-size: 0.82rem;
    color: var(--text2);
    margin-top: -0.4rem;
    margin-bottom: 0.8rem;
}

/* ── Streamlit widget overrides ─────────────────────────────── */
[data-testid="stMetric"] {
    background: var(--bg2) !important;
    border: 1px solid var(--border) !important;
    border-radius: var(--radius) !important;
    padding: 14px 18px !important;
}
div[data-testid="stExpander"] { border: 1px solid var(--border) !important; }
.stButton > button {
    border-radius: 6px !important;
    font-weight: 500 !important;
}
.stTextInput > div > div > input,
.stTextArea > div > div > textarea,
.stSelectbox > div > div {
    background: var(--bg3) !important;
    border: 1px solid var(--border) !important;
    color: var(--text) !important;
    border-radius: 6px !important;
}
.stProgress > div > div { background: var(--blue) !important; }
.stAlert { border-radius: var(--radius) !important; }
hr { border-color: var(--border) !important; }
a { color: var(--blue) !important; }

/* ── Logo / brand ───────────────────────────────────────────── */
.brand {
    font-size: 1.6rem;
    font-weight: 700;
    letter-spacing: -.02em;
}
.brand span { color: var(--blue); }

/* ── Notification dot ────────────────────────────────────────── */
.notif-dot {
    display: inline-block;
    width: 8px; height: 8px;
    background: var(--red);
    border-radius: 50%;
    margin-left: 4px;
    vertical-align: middle;
}
</style>
"""


def inject_custom_css():
    st.markdown(CUSTOM_CSS, unsafe_allow_html=True)


def render_logo():
    st.markdown('<div class="brand">Team<span>Sync</span> 🚀</div>', unsafe_allow_html=True)
    st.markdown('<p style="color:#8b949e;font-size:.85rem;margin-top:2px;">AI-Powered Project Management</p>', unsafe_allow_html=True)


# ─────────────────────────────────────────────────────────────
#  Auth guard — call at the top of every page
# ─────────────────────────────────────────────────────────────

def require_auth():
    inject_custom_css()
    if not st.session_state.get("authenticated"):
        st.warning("Please sign in to access this page.")
        st.stop()
    return st.session_state.user


def render_sidebar(user: dict):
    """Render sidebar navigation and user info."""
    with st.sidebar:
        render_logo()
        st.divider()
        st.markdown(
            f'<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'
            f'<div class="avatar" style="background:{user["avatar_color"]};">'
            f'{user["name"][0].upper()}</div>'
            f'<div><div style="font-weight:600;font-size:.9rem;">{user["name"]}</div>'
            f'<div style="color:#8b949e;font-size:.75rem;">{user["role"].capitalize()}</div></div>'
            f'</div>',
            unsafe_allow_html=True,
        )
        st.divider()
        pages = [
            ("📊", "Dashboard",     "pages/1_Dashboard.py"),
            ("📅", "Meetings",      "pages/2_Meetings.py"),
            ("✅", "Tasks",         "pages/3_Tasks.py"),
            ("👥", "Members",       "pages/4_Members.py"),
            ("📈", "Analytics",     "pages/5_Analytics.py"),
            ("🤖", "AI Assistant",  "pages/6_AI_Assistant.py"),
        ]
        if user.get("role") == "admin":
            pages.append(("⚙️", "Admin",  "pages/7_Admin.py"))
        for icon, label, path in pages:
            if st.button(f"{icon}  {label}", use_container_width=True, key=f"nav_{label}"):
                st.switch_page(path)
        st.divider()
        if st.button("🚪  Sign Out", use_container_width=True):
            for k in ["authenticated", "user", "chat_history"]:
                st.session_state.pop(k, None)
            st.switch_page("app.py")


# ─────────────────────────────────────────────────────────────
#  Small reusable widgets
# ─────────────────────────────────────────────────────────────

def priority_badge(priority: str) -> str:
    return f'<span class="badge badge-{priority}">{priority}</span>'


def status_badge(status: str) -> str:
    label = status.replace("_", " ").title()
    return f'<span class="badge status-{status}">{label}</span>'


def avatar_html(name: str, color: str, size: int = 36) -> str:
    initial = name[0].upper() if name else "?"
    return (
        f'<div class="avatar" style="background:{color};width:{size}px;height:{size}px;'
        f'font-size:{size*0.38:.0f}px;">{initial}</div>'
    )


def card(content_html: str, hover: bool = True) -> None:
    hover_class = "ts-card" if hover else "ts-card-nohover"
    st.markdown(f'<div class="{hover_class}">{content_html}</div>', unsafe_allow_html=True)


def due_label(due_date_str: str | None) -> str:
    if not due_date_str:
        return ""
    try:
        due = datetime.fromisoformat(due_date_str)
        now = datetime.utcnow()
        delta = (due - now).days
        if delta < 0:
            return f'<span style="color:#f85149;font-size:.75rem;">⚠ {abs(delta)}d overdue</span>'
        elif delta == 0:
            return '<span style="color:#d29922;font-size:.75rem;">⏰ Due today</span>'
        elif delta <= 3:
            return f'<span style="color:#d29922;font-size:.75rem;">⏰ {delta}d left</span>'
        else:
            return f'<span style="color:#8b949e;font-size:.75rem;">📅 {due.strftime("%b %d")}</span>'
    except Exception:
        return ""


def sentiment_icon(sentiment: str) -> str:
    icons = {"positive": "😊", "neutral": "😐", "concerning": "😟"}
    return icons.get(sentiment, "😐")


def page_header(title: str, subtitle: str = ""):
    st.markdown(f'<div class="section-title" style="font-size:1.4rem;">{title}</div>', unsafe_allow_html=True)
    if subtitle:
        st.markdown(f'<div class="section-sub">{subtitle}</div>', unsafe_allow_html=True)
