"""
Meetings — full AI pipeline: create → upload audio → transcribe → summarise → extract tasks.
"""
import json
import os
import streamlit as st
from datetime import datetime

from components.ui_helpers import require_auth, render_sidebar, page_header, sentiment_icon
from services.meeting_service import (
    create_meeting, get_all_meetings, get_meeting,
    run_ai_pipeline, save_audio, update_meeting_status, delete_meeting,
)
from services.ai_service import transcribe_audio, generate_action_plan
from services.task_service import get_all_tasks

st.set_page_config(page_title="Meetings — TeamSync", page_icon="📅", layout="wide")
user = require_auth()
render_sidebar(user)

page_header("📅 Meetings", "Record discussions · AI summaries · auto-extracted tasks")
st.divider()

# ─────────────────────────────────────────────────────────────
#  Tabs
# ─────────────────────────────────────────────────────────────
tab_list, tab_new, tab_ai_plan = st.tabs(["All Meetings", "＋ New Meeting", "📋 AI Action Plan"])

# ═════════════════════════════════════════════════════════════
#  TAB 1 — Meeting list
# ═════════════════════════════════════════════════════════════
with tab_list:
    meetings = get_all_meetings()
    if not meetings:
        st.info("No meetings recorded yet. Create your first one →")
    else:
        # Search
        search = st.text_input("🔍 Search meetings", placeholder="title, status…")
        filtered = [
            m for m in meetings
            if not search or search.lower() in m["title"].lower()
        ]
        for m in filtered:
            date_str = datetime.fromisoformat(m["date"]).strftime("%B %d, %Y") if m["date"] else "—"
            sicon    = sentiment_icon(m.get("sentiment", "neutral"))
            status_color = {
                "planned":   "#58a6ff",
                "completed": "#3fb950",
                "cancelled": "#f85149",
            }.get(m["status"], "#8b949e")

            with st.expander(f"{sicon} **{m['title']}** · {date_str} · {m['task_count']} tasks"):
                c_info, c_actions = st.columns([3, 1])
                with c_info:
                    st.markdown(
                        f'<span style="color:{status_color};font-size:.80rem;">● {m["status"].capitalize()}</span>'
                        f' · Created by {m["creator_name"]}',
                        unsafe_allow_html=True,
                    )
                    if m.get("description"):
                        st.caption(m["description"])

                    # AI summary block
                    if m.get("summary"):
                        st.markdown("**AI Summary**")
                        st.markdown(m["summary"])

                        col_dec, col_block = st.columns(2)
                        with col_dec:
                            if m.get("key_decisions"):
                                try:
                                    decisions = json.loads(m["key_decisions"])
                                    if decisions:
                                        st.markdown("**Key Decisions**")
                                        for d in decisions:
                                            st.markdown(f"- {d}")
                                except Exception:
                                    pass
                        with col_block:
                            if m.get("blockers"):
                                try:
                                    blockers = json.loads(m["blockers"])
                                    if blockers:
                                        st.markdown("**Blockers**")
                                        for b in blockers:
                                            st.markdown(f"- ⚠️ {b}")
                                except Exception:
                                    pass

                        if m.get("next_steps"):
                            try:
                                steps = json.loads(m["next_steps"])
                                if steps:
                                    st.markdown("**Next Steps**")
                                    for s in steps:
                                        st.markdown(f"- ➤ {s}")
                            except Exception:
                                pass

                    elif m["status"] == "planned":
                        st.info("Upload audio or add transcript to run AI analysis.")

                    # Transcript viewer
                    if m.get("transcript"):
                        with st.expander("📄 View Transcript"):
                            st.text_area("", value=m["transcript"], height=200, disabled=True, label_visibility="collapsed")

                # ── Upload + process (right column) ──────────────
                with c_actions:
                    st.markdown("**Upload Audio**")
                    audio_file = st.file_uploader(
                        "Meeting recording",
                        type=["mp3", "mp4", "wav", "m4a", "webm", "ogg"],
                        key=f"audio_{m['id']}",
                        label_visibility="collapsed",
                    )
                    manual_transcript = st.text_area(
                        "Or paste transcript",
                        placeholder="Paste meeting notes / transcript here…",
                        height=100,
                        key=f"transcript_{m['id']}",
                    )

                    if st.button("🤖 Run AI Pipeline", key=f"run_ai_{m['id']}", type="primary", use_container_width=True):
                        transcript_text = ""
                        if audio_file is not None:
                            audio_bytes = audio_file.read()
                            with st.spinner("Saving audio…"):
                                filename = save_audio(audio_bytes, audio_file.name)
                            with st.spinner("Transcribing audio (Whisper)…"):
                                transcript_text = transcribe_audio(audio_bytes, audio_file.name)
                        elif manual_transcript.strip():
                            transcript_text = manual_transcript.strip()
                        else:
                            st.warning("Please upload audio or paste a transcript.")
                            st.stop()

                        with st.spinner("🧠 AI analysing meeting…"):
                            result = run_ai_pipeline(m["id"], transcript_text)

                        if result["success"]:
                            st.success(f"✅ Done! Created {result['tasks_created']} tasks.")
                            st.rerun()
                        else:
                            st.error(result["message"])

                    st.divider()
                    # Status update
                    new_status = st.selectbox(
                        "Status",
                        ["planned", "completed", "cancelled"],
                        index=["planned", "completed", "cancelled"].index(m["status"]),
                        key=f"status_{m['id']}",
                    )
                    if st.button("Update Status", key=f"upd_status_{m['id']}", use_container_width=True):
                        update_meeting_status(m["id"], new_status)
                        st.rerun()

                    if user.get("role") == "admin":
                        if st.button("🗑 Delete", key=f"del_meeting_{m['id']}", use_container_width=True):
                            delete_meeting(m["id"])
                            st.rerun()

# ═════════════════════════════════════════════════════════════
#  TAB 2 — Create new meeting
# ═════════════════════════════════════════════════════════════
with tab_new:
    st.markdown("### Schedule a Meeting")
    with st.form("new_meeting_form"):
        title       = st.text_input("Meeting Title*", placeholder="Weekly Sync — Sprint 12")
        col_d, col_t = st.columns(2)
        with col_d:
            m_date  = st.date_input("Date*", value=datetime.now().date())
        with col_t:
            m_time  = st.time_input("Time*", value=datetime.now().time())
        description = st.text_area("Agenda / Description", placeholder="What will be discussed?", height=100)
        submitted   = st.form_submit_button("Schedule Meeting →", type="primary", use_container_width=True)

    if submitted:
        if not title.strip():
            st.error("Meeting title is required.")
        else:
            meeting_dt = datetime.combine(m_date, m_time)
            result = create_meeting(title, meeting_dt, description, user["id"])
            st.success(f"Meeting **{result['title']}** scheduled for {meeting_dt.strftime('%B %d at %H:%M')}!")
            st.rerun()

    st.divider()
    st.markdown(
        """
        **AI Pipeline Flow**

        After creating a meeting, come back to the *All Meetings* tab and:

        1. **Upload** your meeting audio (MP3/WAV/MP4/M4A) — or paste a transcript
        2. Click **Run AI Pipeline** → Claude transcribes, summarises, and extracts tasks
        3. Tasks are **automatically created** in the Kanban board with assignees and priorities
        4. All team members assigned to tasks receive **instant notifications**
        5. Decisions, blockers, and next steps are stored in the meeting record
        """
    )

# ═════════════════════════════════════════════════════════════
#  TAB 3 — AI Action Plan Generator
# ═════════════════════════════════════════════════════════════
with tab_ai_plan:
    st.markdown("### 📋 Generate Next-Week Action Plan")
    st.caption("Powered by Claude — analyses carryover tasks and blockers to build a prioritised plan.")

    all_tasks = get_all_tasks()
    completed = [t for t in all_tasks if t["status"] == "done"]
    pending   = [t for t in all_tasks if t["status"] != "done"]

    col_ctx, col_out = st.columns([1, 1.5])
    with col_ctx:
        new_reqs    = st.text_area("New Requirements / Goals for next week", height=100,
                                   placeholder="e.g. Launch beta, fix auth bug, update docs…")
        blockers_in = st.text_area("Current Blockers", height=80,
                                   placeholder="e.g. Waiting for API keys, DB migration blocked…")
        team_size   = st.number_input("Team Size", min_value=1, max_value=50, value=11)

        if st.button("🤖 Generate Action Plan", type="primary", use_container_width=True):
            context = {
                "completed":       [{"title": t["title"], "assignee": t["assignee_name"]} for t in completed[-10:]],
                "pending":         [{"title": t["title"], "assignee": t["assignee_name"], "priority": t["priority"]} for t in pending[:15]],
                "new_requirements": new_reqs,
                "blockers":        [b.strip() for b in blockers_in.split("\n") if b.strip()],
                "team_size":       team_size,
            }
            with st.spinner("🧠 Generating action plan…"):
                plan = generate_action_plan(context)
            st.session_state["action_plan"] = plan

    with col_out:
        if "action_plan" in st.session_state:
            st.markdown(st.session_state["action_plan"])
            if st.button("📋 Copy to Clipboard (select all text above)", use_container_width=True):
                st.info("Select the text above and copy.")
        else:
            st.info("Fill in the context and click Generate to get your AI action plan.")
