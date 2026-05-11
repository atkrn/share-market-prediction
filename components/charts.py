"""
All Plotly chart builders for Dashboard and Analytics pages.
Every function returns a go.Figure with a consistent dark theme.
"""
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import pandas as pd
from datetime import datetime, timedelta

# ─────────────────────────────────────────────────────────────
#  Shared theme
# ─────────────────────────────────────────────────────────────
_LAYOUT = dict(
    template         = "plotly_dark",
    paper_bgcolor    = "rgba(0,0,0,0)",
    plot_bgcolor     = "rgba(0,0,0,0)",
    font             = dict(family="Inter, sans-serif", color="#e6edf3"),
    margin           = dict(t=40, b=20, l=10, r=10),
    legend           = dict(orientation="h", y=1.08, x=0, font=dict(size=11)),
)
_GRID = dict(gridcolor="rgba(255,255,255,0.06)")

BLUE   = "#58a6ff"
GREEN  = "#3fb950"
YELLOW = "#d29922"
RED    = "#f85149"
PURPLE = "#bc8cff"
ORANGE = "#f0883e"
COLORS = [BLUE, GREEN, YELLOW, RED, PURPLE, ORANGE,
          "#a8edea", "#fee140", "#43e97b", "#f093fb", "#4facfe"]


# ─────────────────────────────────────────────────────────────
#  Task status donut
# ─────────────────────────────────────────────────────────────
def task_status_donut(stats: dict) -> go.Figure:
    labels = ["To Do", "In Progress", "In Review", "Done"]
    values = [
        stats.get("todo", 0),
        stats.get("in_progress", 0),
        stats.get("review", 0),
        stats.get("done", 0),
    ]
    colors = ["#8b949e", BLUE, PURPLE, GREEN]
    fig = go.Figure(go.Pie(
        labels       = labels,
        values       = values,
        hole         = 0.62,
        marker_colors= colors,
        textinfo     = "percent",
        hovertemplate= "%{label}: %{value}<extra></extra>",
    ))
    total = sum(values)
    fig.add_annotation(text=f"<b>{total}</b>", font_size=22, showarrow=False, y=0.05)
    fig.add_annotation(text="Tasks",          font_size=12, showarrow=False, y=-0.08,
                       font=dict(color="#8b949e"))
    fig.update_layout(**_LAYOUT, height=260, title="Task Status", showlegend=True)
    return fig


# ─────────────────────────────────────────────────────────────
#  Member performance bar chart
# ─────────────────────────────────────────────────────────────
def member_performance_bar(member_stats: list[dict]) -> go.Figure:
    if not member_stats:
        return _empty_figure("No member data")
    names    = [m["name"] for m in member_stats]
    done     = [m["done"]        for m in member_stats]
    progress = [m["in_progress"] for m in member_stats]
    todo     = [m["total"] - m["done"] - m["in_progress"] for m in member_stats]

    fig = go.Figure()
    fig.add_trace(go.Bar(name="Done",        x=names, y=done,     marker_color=GREEN,  text=done,     textposition="inside"))
    fig.add_trace(go.Bar(name="In Progress", x=names, y=progress, marker_color=BLUE,   text=progress, textposition="inside"))
    fig.add_trace(go.Bar(name="To Do",       x=names, y=todo,     marker_color="#8b949e", text=todo,  textposition="inside"))
    fig.update_layout(**_LAYOUT, barmode="stack", height=300, title="Member Task Breakdown",
                      yaxis=dict(title="Tasks", **_GRID), xaxis=_GRID)
    return fig


# ─────────────────────────────────────────────────────────────
#  Task completion over time (7-day rolling)
# ─────────────────────────────────────────────────────────────
def task_completion_timeline(tasks: list[dict], days: int = 30) -> go.Figure:
    if not tasks:
        return _empty_figure("No task data")

    end   = datetime.utcnow().date()
    start = end - timedelta(days=days - 1)
    date_range = pd.date_range(start, end, freq="D")
    completed_by_day = {d.date(): 0 for d in date_range}
    created_by_day   = {d.date(): 0 for d in date_range}

    for t in tasks:
        if t.get("completed_at"):
            try:
                d = datetime.fromisoformat(t["completed_at"]).date()
                if d in completed_by_day:
                    completed_by_day[d] += 1
            except Exception:
                pass
        if t.get("created_at"):
            try:
                d = datetime.fromisoformat(t["created_at"]).date()
                if d in created_by_day:
                    created_by_day[d] += 1
            except Exception:
                pass

    dates     = list(date_range)
    completed = [completed_by_day[d.date()] for d in dates]
    created   = [created_by_day[d.date()]   for d in dates]

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=dates, y=created,   name="Created",
        line=dict(color=BLUE,  width=2), fill="tozeroy",
        fillcolor="rgba(88,166,255,.10)",
    ))
    fig.add_trace(go.Scatter(
        x=dates, y=completed, name="Completed",
        line=dict(color=GREEN, width=2), fill="tozeroy",
        fillcolor="rgba(63,185,80,.10)",
    ))
    fig.update_layout(**_LAYOUT, height=280, title=f"Task Activity (last {days} days)",
                      yaxis=dict(title="Count", **_GRID), xaxis=_GRID)
    return fig


# ─────────────────────────────────────────────────────────────
#  Priority breakdown bar
# ─────────────────────────────────────────────────────────────
def priority_breakdown(tasks: list[dict]) -> go.Figure:
    counts = {"low": 0, "medium": 0, "high": 0, "urgent": 0}
    for t in tasks:
        p = t.get("priority", "medium")
        if p in counts:
            counts[p] += 1
    fig = go.Figure(go.Bar(
        x     = [k.capitalize() for k in counts],
        y     = list(counts.values()),
        marker_color = ["#3fb950", "#d29922", "#f0883e", "#f85149"],
        text  = list(counts.values()),
        textposition = "outside",
    ))
    fig.update_layout(**_LAYOUT, height=240, title="Tasks by Priority",
                      yaxis=dict(title="Count", **_GRID), xaxis=_GRID,
                      showlegend=False)
    return fig


# ─────────────────────────────────────────────────────────────
#  Completion rate gauge
# ─────────────────────────────────────────────────────────────
def completion_gauge(rate: float) -> go.Figure:
    color = GREEN if rate >= 70 else (YELLOW if rate >= 40 else RED)
    fig = go.Figure(go.Indicator(
        mode  = "gauge+number+delta",
        value = rate,
        number= {"suffix": "%", "font": {"size": 26, "color": color}},
        delta = {"reference": 70, "relative": False},
        title = {"text": "Completion Rate", "font": {"size": 13, "color": "#8b949e"}},
        gauge = {
            "axis":       {"range": [0, 100], "tickcolor": "#30363d"},
            "bar":        {"color": color, "thickness": 0.28},
            "bgcolor":    "rgba(0,0,0,0)",
            "borderwidth": 0,
            "steps": [
                {"range": [0,  40], "color": "rgba(248,81,73,.12)"},
                {"range": [40, 70], "color": "rgba(210,153,34,.12)"},
                {"range": [70, 100],"color": "rgba(63,185,80,.12)"},
            ],
        },
    ))
    fig.update_layout(**_LAYOUT, height=220, margin=dict(t=40, b=10, l=30, r=30))
    return fig


# ─────────────────────────────────────────────────────────────
#  Meeting frequency bar
# ─────────────────────────────────────────────────────────────
def meeting_frequency(meetings: list[dict], months: int = 3) -> go.Figure:
    if not meetings:
        return _empty_figure("No meeting data")

    end   = datetime.utcnow()
    start = end - timedelta(days=months * 30)
    by_week: dict = {}
    for m in meetings:
        try:
            d = datetime.fromisoformat(m["date"])
        except Exception:
            continue
        if d < start:
            continue
        week = d.strftime("%Y-W%W")
        by_week[week] = by_week.get(week, 0) + 1

    if not by_week:
        return _empty_figure("No meetings in selected period")

    weeks  = sorted(by_week)
    counts = [by_week[w] for w in weeks]
    fig = go.Figure(go.Bar(
        x=weeks, y=counts,
        marker_color=BLUE, text=counts, textposition="outside",
    ))
    fig.update_layout(**_LAYOUT, height=240, title="Meetings per Week",
                      yaxis=dict(title="Count", **_GRID), xaxis=_GRID, showlegend=False)
    return fig


# ─────────────────────────────────────────────────────────────
#  Individual member radar
# ─────────────────────────────────────────────────────────────
def member_radar(stats: dict) -> go.Figure:
    categories = ["Completion Rate", "Tasks Done", "On-Time Delivery",
                  "In Progress", "Total Tasks"]
    values = [
        min(stats.get("completion_rate", 0), 100),
        min(stats.get("done", 0) * 5, 100),
        max(0, 100 - stats.get("overdue", 0) * 10),
        min(stats.get("in_progress", 0) * 10, 100),
        min(stats.get("total", 0) * 5, 100),
    ]
    values.append(values[0])
    categories.append(categories[0])
    fig = go.Figure(go.Scatterpolar(
        r=values, theta=categories,
        fill="toself",
        line_color=BLUE,
        fillcolor="rgba(88,166,255,.15)",
    ))
    fig.update_layout(**_LAYOUT, height=250,
                      polar=dict(
                          radialaxis=dict(visible=True, range=[0, 100], color="#30363d"),
                          angularaxis=dict(color="#8b949e"),
                          bgcolor="rgba(0,0,0,0)",
                      ),
                      showlegend=False)
    return fig


# ─────────────────────────────────────────────────────────────
#  Productivity heatmap (task completions by day-of-week × hour)
# ─────────────────────────────────────────────────────────────
def productivity_heatmap(tasks: list[dict]) -> go.Figure:
    days  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    hours = list(range(0, 24, 2))  # every 2 hours
    z = [[0] * len(days) for _ in hours]

    for t in tasks:
        if t.get("completed_at"):
            try:
                dt = datetime.fromisoformat(t["completed_at"])
                d  = dt.weekday()        # 0=Mon
                h  = dt.hour // 2
                if 0 <= d < 7 and 0 <= h < len(hours):
                    z[h][d] += 1
            except Exception:
                pass

    fig = go.Figure(go.Heatmap(
        z        = z,
        x        = days,
        y        = [f"{h:02d}:00" for h in hours],
        colorscale = [[0, "#161b22"], [1, "#58a6ff"]],
        showscale= True,
        hovertemplate = "%{x} %{y}: %{z} completions<extra></extra>",
    ))
    fig.update_layout(**_LAYOUT, height=280, title="Productivity Heatmap (Task Completions)",
                      yaxis=dict(title="Hour", **_GRID, autorange="reversed"),
                      xaxis=dict(title="Day", **_GRID))
    return fig


# ─────────────────────────────────────────────────────────────
#  Burndown (cumulative remaining tasks)
# ─────────────────────────────────────────────────────────────
def burndown_chart(tasks: list[dict], days: int = 14) -> go.Figure:
    if not tasks:
        return _empty_figure("No tasks")

    end   = datetime.utcnow().date()
    start = end - timedelta(days=days - 1)
    date_range = pd.date_range(start, end, freq="D")
    total = len(tasks)

    remaining = []
    for d in date_range:
        done_by_d = sum(
            1 for t in tasks
            if t.get("completed_at")
            and datetime.fromisoformat(t["completed_at"]).date() <= d.date()
        )
        remaining.append(total - done_by_d)

    ideal = [total - total * i / (days - 1) for i in range(days)]

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=list(date_range), y=ideal, name="Ideal",
        line=dict(color="#30363d", dash="dash", width=1.5),
    ))
    fig.add_trace(go.Scatter(
        x=list(date_range), y=remaining, name="Actual",
        line=dict(color=RED, width=2),
        fill="tozeroy", fillcolor="rgba(248,81,73,.08)",
    ))
    fig.update_layout(**_LAYOUT, height=260, title=f"{days}-Day Burndown",
                      yaxis=dict(title="Remaining Tasks", **_GRID),
                      xaxis=_GRID)
    return fig


# ─────────────────────────────────────────────────────────────
#  Helper
# ─────────────────────────────────────────────────────────────
def _empty_figure(msg: str = "No data available") -> go.Figure:
    fig = go.Figure()
    fig.add_annotation(text=msg, showarrow=False, font=dict(size=14, color="#8b949e"),
                       xref="paper", yref="paper", x=0.5, y=0.5)
    fig.update_layout(**_LAYOUT, height=200)
    return fig
