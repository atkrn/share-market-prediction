"""
All AI features powered by Anthropic Claude.
Voice transcription uses OpenAI Whisper (optional).
"""
import anthropic
import json
import os
from dotenv import load_dotenv

load_dotenv()

_anthropic = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
MODEL = "claude-sonnet-4-6"

# ─────────────────────────────────────────────────────────────
#  Meeting AI Pipeline
# ─────────────────────────────────────────────────────────────

def summarize_meeting(transcript: str, meeting_title: str) -> dict:
    """
    Given a meeting transcript, produce a structured summary with
    key decisions, action items, blockers, next steps, and sentiment.
    """
    prompt = f"""You are an expert project manager AI analyzing a team meeting transcript.

MEETING: "{meeting_title}"

TRANSCRIPT:
{transcript}

Return a JSON object with EXACTLY these keys (no extra text, valid JSON only):
{{
  "summary":        "2-3 paragraph executive summary of the meeting",
  "key_decisions":  ["decision 1", "decision 2"],
  "action_items": [
    {{
      "task":     "clear actionable task description",
      "assignee": "person name or 'TBD'",
      "priority": "urgent|high|medium|low",
      "due":      "timeframe e.g. 'by Friday' or 'next week'"
    }}
  ],
  "blockers":       ["blocker 1", "blocker 2"],
  "next_steps":     ["next step 1", "next step 2"],
  "sentiment":      "positive|neutral|concerning",
  "meeting_health": "brief rating e.g. '7/10 – productive session'"
}}"""

    resp = _anthropic.messages.create(
        model     = MODEL,
        max_tokens= 2000,
        messages  = [{"role": "user", "content": prompt}],
    )
    raw = resp.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "summary":        raw,
            "key_decisions":  [],
            "action_items":   [],
            "blockers":       [],
            "next_steps":     [],
            "sentiment":      "neutral",
            "meeting_health": "N/A",
        }


def extract_tasks(text: str, team_members: list[str]) -> list[dict]:
    """Extract structured tasks from free-form discussion or meeting notes."""
    members_str = ", ".join(team_members) if team_members else "unknown team members"
    prompt = f"""Extract all tasks, assignments, and action items from the text below.

TEAM MEMBERS: {members_str}

TEXT:
{text}

Return a JSON array (no extra text):
[
  {{
    "title":       "clear actionable task title",
    "description": "additional detail if mentioned",
    "assignee":    "name from the team or 'Unassigned'",
    "priority":    "urgent|high|medium|low",
    "due_date":    "date/timeframe or null",
    "tags":        ["tag1", "tag2"]
  }}
]"""
    resp = _anthropic.messages.create(
        model     = MODEL,
        max_tokens= 1500,
        messages  = [{"role": "user", "content": prompt}],
    )
    raw = resp.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return []


def generate_weekly_report(data: dict) -> str:
    """Generate a markdown weekly project report from aggregated stats."""
    prompt = f"""Generate a professional weekly project report (markdown format).

WEEK: {data.get('week', 'Current Week')}
TEAM SIZE: {data.get('team_size', 'N/A')} members
TOTAL TASKS: {data.get('total_tasks', 0)}
COMPLETED: {data.get('completed_tasks', 0)}
IN PROGRESS: {data.get('in_progress_tasks', 0)}
OVERDUE: {data.get('overdue_tasks', 0)}
MEETINGS HELD: {data.get('meetings', 0)}
COMPLETION RATE: {data.get('completion_rate', 0):.1f}%

TOP PERFORMERS:
{json.dumps(data.get('top_performers', []), indent=2)}

PENDING BY MEMBER:
{json.dumps(data.get('pending_by_member', {}), indent=2)}

BLOCKERS:
{json.dumps(data.get('blockers', []), indent=2)}

Sections to include:
1. Executive Summary
2. Progress Highlights
3. Team Performance Analysis
4. Risk Areas & Blockers
5. Recommendations for Next Week
6. Overall Project Health (score 1-10 + explanation)"""

    resp = _anthropic.messages.create(
        model     = MODEL,
        max_tokens= 2000,
        messages  = [{"role": "user", "content": prompt}],
    )
    return resp.content[0].text


def predict_risks(tasks_data: list[dict]) -> str:
    """Analyse task data and return a markdown risk report."""
    prompt = f"""You are a project risk analyst. Analyse the following task data and identify risks.

TASKS:
{json.dumps(tasks_data, indent=2)}

Provide (markdown format):
1. **Overall Risk Level**: Low / Medium / High / Critical
2. **Top Risk Factors** (top 3 with explanation)
3. **Tasks Most Likely to Cause Delays**
4. **Mitigation Strategies**
5. **Estimated Impact on Timeline**

Be concise and actionable."""
    resp = _anthropic.messages.create(
        model     = MODEL,
        max_tokens= 1000,
        messages  = [{"role": "user", "content": prompt}],
    )
    return resp.content[0].text


def generate_action_plan(context: dict) -> str:
    """Generate next-week action plan from carryover tasks and blockers."""
    prompt = f"""Based on this week's project status, generate a prioritised action plan for next week.

COMPLETED THIS WEEK:
{json.dumps(context.get('completed', []), indent=2)}

PENDING / CARRYOVER:
{json.dumps(context.get('pending', []), indent=2)}

NEW REQUIREMENTS: {context.get('new_requirements', 'None')}
BLOCKERS TO RESOLVE: {json.dumps(context.get('blockers', []), indent=2)}
TEAM SIZE: {context.get('team_size', 'N/A')}

Provide (markdown):
1. **Top Priorities** (max 5, ordered)
2. **Task Assignments by Member**
3. **Milestones to Hit**
4. **Blockers to Resolve First**
5. **Success Metrics for Next Week**"""
    resp = _anthropic.messages.create(
        model     = MODEL,
        max_tokens= 1500,
        messages  = [{"role": "user", "content": prompt}],
    )
    return resp.content[0].text


# ─────────────────────────────────────────────────────────────
#  AI Chatbot
# ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are TeamSync AI, an expert project management assistant embedded in a team collaboration platform.

You help the team with:
- Project status queries and summaries
- Task management advice and prioritisation
- Meeting preparation and follow-up
- Productivity tips and recommendations
- Risk assessment and mitigation
- Team coordination and communication

Be concise, professional, and actionable. Use bullet points and structure when helpful.
If asked about specific data (tasks, meetings, members), use the project context provided."""


def chat(messages: list[dict], project_context: dict) -> str:
    """
    messages: [{"role": "user"|"assistant", "content": "..."}]
    project_context: dict with summary stats injected into the system prompt
    """
    context_block = f"""
CURRENT PROJECT SNAPSHOT:
- Team size: {project_context.get('team_size', 'N/A')} members
- Total tasks: {project_context.get('total_tasks', 0)}
- Completed: {project_context.get('completed_tasks', 0)}
- In progress: {project_context.get('in_progress_tasks', 0)}
- Overdue: {project_context.get('overdue_tasks', 0)}
- Upcoming meetings: {project_context.get('upcoming_meetings', 0)}
- Last meeting: {project_context.get('last_meeting', 'N/A')}
- Recent blockers: {project_context.get('recent_blockers', 'None')}
"""
    system = SYSTEM_PROMPT + context_block
    resp = _anthropic.messages.create(
        model     = MODEL,
        max_tokens= 1000,
        system    = system,
        messages  = messages,
    )
    return resp.content[0].text


# ─────────────────────────────────────────────────────────────
#  Voice Transcription  (optional – requires OpenAI key)
# ─────────────────────────────────────────────────────────────

def transcribe_audio(audio_bytes: bytes, filename: str) -> str:
    """Transcribe audio using OpenAI Whisper. Returns transcript string."""
    openai_key = os.getenv("OPENAI_API_KEY", "")
    if not openai_key:
        return (
            "[Voice transcription requires an OPENAI_API_KEY in your .env file. "
            "Please add it or paste the meeting notes manually below.]"
        )
    try:
        import openai
        client = openai.OpenAI(api_key=openai_key)
        import io
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = filename
        transcript = client.audio.transcriptions.create(
            model = "whisper-1",
            file  = audio_file,
        )
        return transcript.text
    except Exception as e:
        return f"[Transcription error: {e}]"
