import warnings
warnings.filterwarnings("ignore")

import yfinance as yf
import pandas as pd
import numpy as np
import ta
from statsmodels.tsa.arima.model import ARIMA
import xgboost as xgb
from sklearn.model_selection import train_test_split
from textblob import TextBlob
import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# ════════════════════════════════════════════════════════════
#  PAGE CONFIG
# ════════════════════════════════════════════════════════════
st.set_page_config(
    page_title="AI Stock Advisor",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.markdown("""
<style>
    .block-container { padding-top: 1.5rem; padding-bottom: 2rem; }
    .stMetric { background: #1e2130; border-radius: 10px; padding: 12px 16px; }
    .ticker-chip {
        display: inline-block; background: #1e2130; color: #a0aec0;
        border-radius: 6px; padding: 3px 10px; margin: 3px;
        font-size: 13px; font-family: monospace; cursor: pointer;
    }
    .news-card {
        background: #1e2130; border-radius: 8px;
        padding: 10px 14px; margin-bottom: 8px;
        border-left: 3px solid #4a5568;
    }
    .section-header {
        font-size: 18px; font-weight: 600;
        margin-top: 1rem; margin-bottom: 0.5rem;
    }
</style>
""", unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════
#  DATA LOADER
# ════════════════════════════════════════════════════════════
@st.cache_data(ttl=300, show_spinner=False)
def get_stock_data(ticker):
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period="2y")
        info = stock.info
        try:
            news = stock.news
        except Exception:
            news = []
        return df, info, news
    except Exception as e:
        return None, {}, []


# ════════════════════════════════════════════════════════════
#  TECHNICAL INDICATORS
# ════════════════════════════════════════════════════════════
def compute_technical(df):
    df = df.copy()

    # RSI
    df['rsi'] = ta.momentum.RSIIndicator(df['Close']).rsi()

    # MACD
    macd = ta.trend.MACD(df['Close'])
    df['macd'] = macd.macd()
    df['macd_signal'] = macd.macd_signal()
    df['macd_diff'] = macd.macd_diff()

    # Bollinger Bands
    bb = ta.volatility.BollingerBands(df['Close'])
    df['bb_high'] = bb.bollinger_hband()
    df['bb_low'] = bb.bollinger_lband()
    df['bb_mid'] = bb.bollinger_mavg()
    df['bb_pct'] = bb.bollinger_pband()

    # Moving Averages
    df['sma20']  = df['Close'].rolling(20).mean()
    df['sma50']  = df['Close'].rolling(50).mean()
    df['sma200'] = df['Close'].rolling(200).mean()
    df['ema12']  = df['Close'].ewm(span=12, adjust=False).mean()
    df['ema26']  = df['Close'].ewm(span=26, adjust=False).mean()

    # Volume Analysis
    df['volume_sma']   = df['Volume'].rolling(20).mean()
    df['volume_ratio'] = df['Volume'] / df['volume_sma'].replace(0, np.nan)

    # Returns & Volatility
    df['daily_return'] = df['Close'].pct_change()
    df['volatility']   = df['daily_return'].rolling(20).std()

    # ATR
    df['atr'] = ta.volatility.AverageTrueRange(df['High'], df['Low'], df['Close']).average_true_range()

    return df


# ════════════════════════════════════════════════════════════
#  ARIMA FORECAST  (fixed: 1-step ahead, not mean of 5)
# ════════════════════════════════════════════════════════════
def arima_forecast(series):
    try:
        model     = ARIMA(series.dropna().tail(200), order=(5, 1, 0))
        model_fit = model.fit()
        forecast  = model_fit.forecast(steps=1)
        return float(forecast.iloc[0])
    except Exception:
        return float(series.iloc[-1])


# ════════════════════════════════════════════════════════════
#  XGBOOST FORECAST  (upgraded: 13 features instead of 1)
# ════════════════════════════════════════════════════════════
def xgb_forecast(df):
    try:
        df = df.copy()
        feature_cols = [
            'Close', 'Volume', 'rsi', 'macd', 'macd_signal',
            'sma20', 'sma50', 'ema12', 'ema26',
            'bb_high', 'bb_low', 'volatility', 'volume_ratio'
        ]
        df['target'] = df['Close'].shift(-1)
        df = df[feature_cols + ['target']].dropna()

        if len(df) < 60:
            return float(df['Close'].iloc[-1])

        X = df[feature_cols]
        y = df['target']

        split   = int(len(df) * 0.8)
        X_train = X.iloc[:split]
        y_train = y.iloc[:split]

        model = xgb.XGBRegressor(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=4,
            subsample=0.8,
            colsample_bytree=0.8,
            verbosity=0,
            random_state=42
        )
        model.fit(X_train, y_train)
        return float(model.predict(X.tail(1))[0])
    except Exception:
        return float(df['Close'].iloc[-1])


# ════════════════════════════════════════════════════════════
#  SENTIMENT  (real news via yfinance, not hardcoded)
# ════════════════════════════════════════════════════════════
def sentiment_score(news):
    try:
        if not news:
            return 0.5   # neutral default

        scores = []
        for item in news[:15]:
            title = ""
            # handle both old and new yfinance news structures
            if isinstance(item, dict):
                title = item.get('title', '') or item.get('content', {}).get('title', '')
            if title:
                scores.append(TextBlob(str(title)).sentiment.polarity)

        if not scores:
            return 0.5

        raw = float(np.mean(scores))
        return round((raw + 1) / 2, 4)   # map -1..1  →  0..1
    except Exception:
        return 0.5


# ════════════════════════════════════════════════════════════
#  FUNDAMENTAL SCORE  (expanded: 5 metrics)
# ════════════════════════════════════════════════════════════
def fundamental_score(info):
    if not info:
        return 0.5

    score = 0
    total = 5

    roe           = info.get('returnOnEquity')
    debt_equity   = info.get('debtToEquity')
    profit_margin = info.get('profitMargins')
    pe_ratio      = info.get('trailingPE')
    current_ratio = info.get('currentRatio')

    if roe           is not None and roe > 0.15:            score += 1
    if debt_equity   is not None and debt_equity < 100:     score += 1
    if profit_margin is not None and profit_margin > 0.10:  score += 1
    if pe_ratio      is not None and 0 < pe_ratio < 30:     score += 1
    if current_ratio is not None and current_ratio > 1.5:   score += 1

    return round(score / total, 4)


# ════════════════════════════════════════════════════════════
#  TECHNICAL SCORE  (expanded: 5 signals)
# ════════════════════════════════════════════════════════════
def technical_score(df):
    try:
        latest = df.iloc[-1]
        score  = 0

        rsi = latest['rsi']
        if rsi < 30:
            score += 2      # strongly oversold
        elif rsi < 45:
            score += 1
        elif rsi > 70:
            score -= 1      # overbought

        if latest['macd'] > latest['macd_signal']:
            score += 1
        else:
            score -= 1

        if latest['sma50'] > latest['sma200']:
            score += 1      # golden cross
        else:
            score -= 1      # death cross

        if latest['Close'] > latest['sma20']:
            score += 1
        else:
            score -= 1

        if latest['volume_ratio'] > 1.5:
            score += 1      # above-average volume = conviction

        # normalise: min = -3, max = 6  →  0..1
        return round(max(0.0, min(1.0, (score + 3) / 9)), 4)
    except Exception:
        return 0.5


# ════════════════════════════════════════════════════════════
#  FINAL DECISION  (fixed score formula)
# ════════════════════════════════════════════════════════════
def final_decision(tech, fund, forecast, sentiment_norm, current_price):
    pct_change     = (forecast - current_price) / current_price
    forecast_score = max(0.0, min(1.0, 0.5 + pct_change * 10))

    score = (
        tech           * 0.30 +
        fund           * 0.25 +
        forecast_score * 0.25 +
        sentiment_norm * 0.20
    )
    score = round(score, 4)

    if score > 0.62:
        decision = "BUY"
    elif score > 0.42:
        decision = "HOLD"
    else:
        decision = "SELL"

    components = {
        'Technical':    round(tech,           3),
        'Fundamental':  round(fund,           3),
        'Forecast':     round(forecast_score, 3),
        'Sentiment':    round(sentiment_norm, 3),
    }
    return decision, score, components


# ════════════════════════════════════════════════════════════
#  CHARTS
# ════════════════════════════════════════════════════════════
def plot_price_chart(df, ticker):
    fig = make_subplots(
        rows=3, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.04,
        row_heights=[0.60, 0.20, 0.20],
        subplot_titles=(f'{ticker} — Price, Bollinger Bands & Moving Averages', 'Volume', 'RSI')
    )

    # Candlestick
    fig.add_trace(go.Candlestick(
        x=df.index,
        open=df['Open'], high=df['High'],
        low=df['Low'],   close=df['Close'],
        name='Price',
        increasing_line_color='#26a69a',
        decreasing_line_color='#ef5350'
    ), row=1, col=1)

    # Bollinger Bands
    fig.add_trace(go.Scatter(
        x=df.index, y=df['bb_high'], name='BB Upper',
        line=dict(color='rgba(100,149,237,0.45)', width=1), showlegend=True
    ), row=1, col=1)
    fig.add_trace(go.Scatter(
        x=df.index, y=df['bb_low'], name='BB Lower',
        fill='tonexty', fillcolor='rgba(100,149,237,0.07)',
        line=dict(color='rgba(100,149,237,0.45)', width=1), showlegend=True
    ), row=1, col=1)

    # Moving Averages
    fig.add_trace(go.Scatter(
        x=df.index, y=df['sma50'],  name='SMA 50',
        line=dict(color='#ffa726', width=1.5)
    ), row=1, col=1)
    fig.add_trace(go.Scatter(
        x=df.index, y=df['sma200'], name='SMA 200',
        line=dict(color='#ab47bc', width=1.5)
    ), row=1, col=1)
    fig.add_trace(go.Scatter(
        x=df.index, y=df['sma20'],  name='SMA 20',
        line=dict(color='#29b6f6', width=1.2, dash='dot')
    ), row=1, col=1)

    # Volume
    vol_colors = ['#26a69a' if c >= o else '#ef5350'
                  for c, o in zip(df['Close'], df['Open'])]
    fig.add_trace(go.Bar(
        x=df.index, y=df['Volume'],
        marker_color=vol_colors, name='Volume', showlegend=False
    ), row=2, col=1)

    # RSI
    fig.add_trace(go.Scatter(
        x=df.index, y=df['rsi'],
        line=dict(color='#26c6da', width=1.5),
        name='RSI', showlegend=False
    ), row=3, col=1)
    fig.add_hrect(y0=70, y1=100, fillcolor='rgba(239,83,80,0.10)',  line_width=0, row=3, col=1)
    fig.add_hrect(y0=0,  y1=30,  fillcolor='rgba(38,166,154,0.10)', line_width=0, row=3, col=1)
    fig.add_hline(y=70, line_dash='dash', line_color='#ef5350', opacity=0.6, row=3, col=1)
    fig.add_hline(y=30, line_dash='dash', line_color='#26a69a', opacity=0.6, row=3, col=1)

    fig.update_layout(
        height=620,
        template='plotly_dark',
        xaxis_rangeslider_visible=False,
        margin=dict(t=50, b=10, l=10, r=10),
        legend=dict(orientation='h', y=1.04, x=0, font=dict(size=11)),
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
    )
    fig.update_yaxes(gridcolor='rgba(255,255,255,0.05)')
    fig.update_xaxes(gridcolor='rgba(255,255,255,0.05)')
    return fig


def plot_macd_chart(df):
    colors = ['#26a69a' if v >= 0 else '#ef5350' for v in df['macd_diff']]
    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=df.index, y=df['macd_diff'],
        marker_color=colors, name='Histogram', opacity=0.7
    ))
    fig.add_trace(go.Scatter(
        x=df.index, y=df['macd'],
        line=dict(color='#26c6da', width=1.5), name='MACD'
    ))
    fig.add_trace(go.Scatter(
        x=df.index, y=df['macd_signal'],
        line=dict(color='#ffa726', width=1.5), name='Signal'
    ))
    fig.update_layout(
        title='MACD', height=260, template='plotly_dark',
        margin=dict(t=40, b=10, l=10, r=10),
        legend=dict(orientation='h', y=1.1, font=dict(size=11)),
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
    )
    fig.update_yaxes(gridcolor='rgba(255,255,255,0.05)')
    fig.update_xaxes(gridcolor='rgba(255,255,255,0.05)')
    return fig


def plot_gauge(score, decision):
    color = '#26a69a' if decision == 'BUY' else '#ef5350' if decision == 'SELL' else '#ffa726'
    fig = go.Figure(go.Indicator(
        mode='gauge+number',
        value=round(score * 100, 1),
        number={'suffix': '/100', 'font': {'size': 28, 'color': color}},
        title={'text': 'Confidence Score', 'font': {'size': 14, 'color': '#a0aec0'}},
        gauge={
            'axis': {'range': [0, 100], 'tickcolor': '#4a5568'},
            'bar': {'color': color, 'thickness': 0.25},
            'bgcolor': 'rgba(0,0,0,0)',
            'borderwidth': 0,
            'steps': [
                {'range': [0,  42], 'color': 'rgba(239,83,80,0.15)'},
                {'range': [42, 62], 'color': 'rgba(255,167,38,0.15)'},
                {'range': [62,100], 'color': 'rgba(38,166,154,0.15)'},
            ],
        }
    ))
    fig.update_layout(
        height=220,
        template='plotly_dark',
        margin=dict(t=40, b=10, l=30, r=30),
        paper_bgcolor='rgba(0,0,0,0)',
    )
    return fig


def plot_score_radar(components):
    labels = list(components.keys())
    values = [v * 100 for v in components.values()]
    values.append(values[0])
    labels.append(labels[0])

    fig = go.Figure(go.Scatterpolar(
        r=values, theta=labels,
        fill='toself',
        line_color='#26c6da',
        fillcolor='rgba(38,198,218,0.15)',
        name='Score'
    ))
    fig.update_layout(
        polar=dict(
            radialaxis=dict(visible=True, range=[0, 100], color='#4a5568'),
            angularaxis=dict(color='#a0aec0'),
            bgcolor='rgba(0,0,0,0)',
        ),
        template='plotly_dark',
        height=260,
        margin=dict(t=30, b=10, l=30, r=30),
        paper_bgcolor='rgba(0,0,0,0)',
        showlegend=False
    )
    return fig


# ════════════════════════════════════════════════════════════
#  HELPER — currency symbol
# ════════════════════════════════════════════════════════════
def get_currency_symbol(info):
    currency = (info or {}).get('currency', 'INR')
    return {'INR': '₹', 'USD': '$', 'GBP': '£', 'EUR': '€'}.get(currency, currency + ' ')


# ════════════════════════════════════════════════════════════
#  UI — HEADER
# ════════════════════════════════════════════════════════════
st.markdown("## 📈 AI Stock Recommendation System")
st.caption("Technical Analysis · Fundamental Data · ML Forecasting · Real Sentiment")

st.warning(
    "⚠️ **Disclaimer:** This tool is for **educational purposes only**. "
    "It is NOT financial advice. Do NOT make real investment decisions based on this app. "
    "Always consult a SEBI-registered financial advisor before investing."
)

# ════════════════════════════════════════════════════════════
#  UI — INPUT
# ════════════════════════════════════════════════════════════
col_inp, col_btn = st.columns([4, 1])
with col_inp:
    ticker = st.text_input(
        "🔍 Stock Ticker",
        placeholder="e.g.  RELIANCE.NS   TCS.NS   AAPL   TSLA",
        label_visibility='collapsed'
    )
with col_btn:
    analyze = st.button("Analyze ▶", use_container_width=True, type='primary')

st.markdown(
    "**Popular:** "
    "`RELIANCE.NS`  `TCS.NS`  `INFY.NS`  `HDFCBANK.NS`  "
    "`WIPRO.NS`  `AAPL`  `TSLA`  `GOOGL`  `MSFT`"
)

# ════════════════════════════════════════════════════════════
#  ANALYSIS
# ════════════════════════════════════════════════════════════
if analyze and ticker.strip():
    ticker = ticker.strip().upper()

    with st.spinner(f"🔄 Fetching and analysing **{ticker}** — please wait 30–60 seconds…"):
        df, info, news = get_stock_data(ticker)

    if df is None or df.empty:
        st.error(
            f"❌ Could not fetch data for **{ticker}**. "
            "Please check the ticker and try again. "
            "Indian stocks need `.NS` (NSE) or `.BO` (BSE) suffix."
        )
        st.stop()

    df = compute_technical(df)

    current_price = float(df['Close'].iloc[-1])
    prev_price    = float(df['Close'].iloc[-2])
    price_change  = current_price - prev_price
    price_pct     = (price_change / prev_price) * 100
    sym           = get_currency_symbol(info)

    with st.spinner("🧠 Running ML models…"):
        arima_pred = arima_forecast(df['Close'])
        xgb_pred   = xgb_forecast(df)
        forecast   = (arima_pred + xgb_pred) / 2.0

        tech    = technical_score(df)
        fund    = fundamental_score(info)
        sent    = sentiment_score(news)
        decision, score, components = final_decision(tech, fund, forecast, sent, current_price)

    # ── Company header ────────────────────────────────────────
    company_name = (info or {}).get('longName', ticker)
    sector       = (info or {}).get('sector', '')
    industry     = (info or {}).get('industry', '')

    st.divider()
    st.subheader(f"📌 {company_name}  ({ticker})")
    if sector:
        st.caption(f"{sector}  ·  {industry}")

    # ── Top metrics ───────────────────────────────────────────
    m1, m2, m3, m4, m5, m6 = st.columns(6)
    info = info or {}

    m1.metric("Current Price",  f"{sym}{current_price:,.2f}",
              f"{price_pct:+.2f}%",
              delta_color='normal')
    m2.metric("Forecast (Next Day)", f"{sym}{forecast:,.2f}",
              f"{((forecast - current_price)/current_price)*100:+.2f}%",
              delta_color='normal')
    m3.metric("52W High",
              f"{sym}{info['fiftyTwoWeekHigh']:,.2f}" if info.get('fiftyTwoWeekHigh') else "N/A")
    m4.metric("52W Low",
              f"{sym}{info['fiftyTwoWeekLow']:,.2f}" if info.get('fiftyTwoWeekLow') else "N/A")
    m5.metric("P/E Ratio",
              f"{info['trailingPE']:.1f}x" if info.get('trailingPE') else "N/A")
    m6.metric("Market Cap",
              f"{sym}{info['marketCap']/1e9:,.1f}B" if info.get('marketCap') else "N/A")

    st.divider()

    # ── Recommendation row ────────────────────────────────────
    rec_col, gauge_col, radar_col = st.columns([1.2, 1, 1])

    with rec_col:
        st.markdown("### 🎯 Recommendation")
        if decision == "BUY":
            st.success(f"## ✅  BUY")
            st.write(
                "Multiple signals align positively. "
                "Price momentum, fundamentals, and sentiment support accumulation. "
                "Consider buying in tranches."
            )
        elif decision == "SELL":
            st.error(f"## 🔴  SELL")
            st.write(
                "Signals indicate weakness across multiple dimensions. "
                "Consider reducing or exiting your position "
                "and waiting for a better entry."
            )
        else:
            st.warning(f"## 🟡  HOLD")
            st.write(
                "Signals are mixed. No clear directional conviction. "
                "Wait for a stronger trend to emerge before adding "
                "or reducing your position."
            )

        st.divider()
        st.markdown("**Score Breakdown**")
        icons = {'Technical': '📊', 'Fundamental': '🏢', 'Forecast': '🔮', 'Sentiment': '📰'}
        for name, val in components.items():
            pct = int(val * 100)
            bar = "█" * (pct // 10) + "░" * (10 - pct // 10)
            st.markdown(f"`{icons[name]} {name:<13}` `{bar}` **{pct}/100**")

    with gauge_col:
        st.plotly_chart(plot_gauge(score, decision), use_container_width=True)

        # RSI status
        rsi_val = float(df['rsi'].iloc[-1])
        if rsi_val < 30:
            st.error(f"📊 RSI: **{rsi_val:.1f}** — Oversold ↑ Potential buy zone")
        elif rsi_val > 70:
            st.warning(f"📊 RSI: **{rsi_val:.1f}** — Overbought ↓ Caution")
        else:
            st.info(f"📊 RSI: **{rsi_val:.1f}** — Neutral zone")

    with radar_col:
        st.plotly_chart(plot_score_radar(components), use_container_width=True)

    st.divider()

    # ── Price Chart ────────────────────────────────────────────
    st.markdown("### 📈 Price Chart (6 months)")
    st.plotly_chart(plot_price_chart(df.tail(180), ticker), use_container_width=True)

    # ── MACD + Fundamentals ────────────────────────────────────
    macd_col, fund_col = st.columns([1.3, 1])

    with macd_col:
        st.plotly_chart(plot_macd_chart(df.tail(180)), use_container_width=True)

    with fund_col:
        st.markdown("### 🏢 Fundamental Data")
        fund_data = {
            "P/E Ratio":        f"{info['trailingPE']:.1f}x"                          if info.get('trailingPE')         else "N/A",
            "EPS":              f"{sym}{info['trailingEps']:.2f}"                      if info.get('trailingEps')        else "N/A",
            "ROE":              f"{info['returnOnEquity']*100:.1f}%"                   if info.get('returnOnEquity')     else "N/A",
            "Debt / Equity":    f"{info['debtToEquity']:.1f}"                          if info.get('debtToEquity')       else "N/A",
            "Profit Margin":    f"{info['profitMargins']*100:.1f}%"                    if info.get('profitMargins')      else "N/A",
            "Current Ratio":    f"{info['currentRatio']:.2f}"                          if info.get('currentRatio')       else "N/A",
            "Revenue (TTM)":    f"{sym}{info['totalRevenue']/1e9:,.1f}B"               if info.get('totalRevenue')       else "N/A",
            "Dividend Yield":   f"{info['dividendYield']*100:.2f}%"                    if info.get('dividendYield')      else "N/A",
            "Beta":             f"{info['beta']:.2f}"                                  if info.get('beta')               else "N/A",
            "Book Value":       f"{sym}{info['bookValue']:.2f}"                        if info.get('bookValue')          else "N/A",
        }

        col_a, col_b = st.columns(2)
        items = list(fund_data.items())
        for i, (k, v) in enumerate(items):
            (col_a if i % 2 == 0 else col_b).metric(k, v)

    st.divider()

    # ── News & Sentiment ────────────────────────────────────────
    st.markdown("### 📰 Latest News & Sentiment")

    if news:
        for item in news[:8]:
            title = ""
            link  = "#"
            if isinstance(item, dict):
                title = item.get('title', '') or item.get('content', {}).get('title', '')
                link  = item.get('link',  '') or item.get('content', {}).get('clickThroughUrl', {}).get('url', '#')

            if not title:
                continue

            polarity = TextBlob(str(title)).sentiment.polarity
            if polarity > 0.1:
                icon, color = "🟢", "#26a69a"
                label = "Positive"
            elif polarity < -0.1:
                icon, color = "🔴", "#ef5350"
                label = "Negative"
            else:
                icon, color = "🟡", "#ffa726"
                label = "Neutral"

            st.markdown(
                f"<div class='news-card' style='border-left-color:{color};'>"
                f"{icon} <a href='{link}' target='_blank' style='color:#e2e8f0; text-decoration:none;'>"
                f"{title}</a> "
                f"<span style='font-size:11px; color:{color};'>({label})</span>"
                f"</div>",
                unsafe_allow_html=True
            )
    else:
        st.info("No recent news found for this ticker.")

    st.divider()

    # ── Risk section ────────────────────────────────────────────
    st.markdown("### ⚠️ Risks & Limitations")
    r1, r2, r3, r4 = st.columns(4)
    r1.error("**Model Risk**\nML models can be wrong. Past patterns don't guarantee future results.")
    r2.warning("**Market Risk**\nSudden news, RBI policy, global events can override all signals instantly.")
    r3.info("**Data Risk**\nSentiment is based on recent headlines only. Fundamental data may be delayed.")
    r4.info("**Liquidity Risk**\nSmall-cap stocks may be hard to buy/sell at shown prices.")

    st.info(
        "💡 **Contrarian View:** Even with a strong BUY signal, always check broader market "
        "conditions, sector rotation, and your own risk tolerance. Never invest more than "
        "you can afford to lose."
    )

    # ── Footer ─────────────────────────────────────────────────
    st.divider()
    st.caption(
        "⚠️ This app is for **educational purposes only**. "
        "Not financial advice. Not SEBI registered. "
        "Data sourced from Yahoo Finance. "
        "Forecasts are estimates and may not reflect actual future prices."
    )

elif analyze and not ticker.strip():
    st.warning("Please enter a stock ticker to analyse.")
