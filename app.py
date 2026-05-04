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

# =========================
# DATA LOADER
# =========================
def get_stock_data(ticker):
    stock = yf.Ticker(ticker)
    df = stock.history(period="2y")
    info = stock.info
    return df, info

# =========================
# TECHNICAL ANALYSIS
# =========================
def compute_technical(df):
    df['rsi'] = ta.momentum.RSIIndicator(df['Close']).rsi()

    macd = ta.trend.MACD(df['Close'])
    df['macd'] = macd.macd()
    df['macd_signal'] = macd.macd_signal()

    bb = ta.volatility.BollingerBands(df['Close'])
    df['bb_high'] = bb.bollinger_hband()
    df['bb_low'] = bb.bollinger_lband()

    df['sma50'] = df['Close'].rolling(50).mean()
    df['sma200'] = df['Close'].rolling(200).mean()

    return df

# =========================
# FORECASTING
# =========================
def arima_forecast(series):
    try:
        model = ARIMA(series, order=(5,1,0))
        model_fit = model.fit()
        forecast = model_fit.forecast(steps=5)
        return forecast.mean()
    except:
        return series.iloc[-1]

def xgb_forecast(df):
    df = df.copy()
    df['target'] = df['Close'].shift(-1)
    df = df.dropna()

    X = df[['Close']]
    y = df['target']

    if len(df) < 50:
        return df['Close'].iloc[-1]

    X_train, X_test, y_train, y_test = train_test_split(X, y)

    model = xgb.XGBRegressor(verbosity=0)
    model.fit(X_train, y_train)

    pred = model.predict(X.tail(1))
    return pred[0]

# =========================
# FUNDAMENTAL ANALYSIS
# =========================
def fundamental_score(info):
    score = 0
    total = 3

    if info.get('returnOnEquity'):
        if info['returnOnEquity'] > 0.15:
            score += 1

    if info.get('debtToEquity'):
        if info['debtToEquity'] < 100:
            score += 1

    if info.get('profitMargins'):
        if info['profitMargins'] > 0.1:
            score += 1

    return score / total

# =========================
# SENTIMENT ANALYSIS
# =========================
def sentiment_score():
    # Placeholder (replace with real API later)
    news = [
        "market is optimistic",
        "company shows strong growth",
        "positive outlook from analysts"
    ]

    score = 0
    for n in news:
        score += TextBlob(n).sentiment.polarity

    return score / len(news)

# =========================
# TECH SCORE LOGIC
# =========================
def technical_score(df):
    latest = df.iloc[-1]

    score = 0

    # RSI
    if latest['rsi'] < 30:
        score += 1
    elif latest['rsi'] > 70:
        score -= 1

    # MACD
    if latest['macd'] > latest['macd_signal']:
        score += 1
    else:
        score -= 1

    # Moving Average
    if latest['sma50'] > latest['sma200']:
        score += 1
    else:
        score -= 1

    return (score + 3) / 6  # normalize 0-1

# =========================
# FINAL DECISION
# =========================
def final_decision(tech, fund, forecast, sentiment, current_price):
    forecast_score = forecast / current_price

    score = (
        tech * 0.30 +
        fund * 0.30 +
        forecast_score * 0.25 +
        sentiment * 0.15
    )

    if score > 0.6:
        decision = "BUY"
    elif score > 0.4:
        decision = "HOLD"
    else:
        decision = "SELL"

    return decision, score

# =========================
# MAIN PIPELINE
# =========================
def analyze_stock(ticker):
    df, info = get_stock_data(ticker)

    if df.empty:
        return "Invalid Ticker", 0, {}

    df = compute_technical(df)

    current_price = df['Close'].iloc[-1]

    arima_pred = arima_forecast(df['Close'])
    xgb_pred = xgb_forecast(df)

    forecast = (arima_pred + xgb_pred) / 2

    tech = technical_score(df)
    fund = fundamental_score(info)
    sentiment = sentiment_score()

    decision, score = final_decision(tech, fund, forecast, sentiment, current_price)

    result = {
        "Current Price": current_price,
        "Forecast Price": forecast,
        "Technical Score": tech,
        "Fundamental Score": fund,
        "Sentiment Score": sentiment
    }

    return decision, score, result

# =========================
# STREAMLIT FRONTEND
# =========================
st.title("📊 AI Stock Recommendation System")

ticker = st.text_input("Enter Stock Ticker (e.g. RELIANCE.NS)")

if st.button("Analyze"):
    decision, score, details = analyze_stock(ticker)

    st.subheader(f"Recommendation: {decision}")
    st.write(f"Confidence Score: {round(score*100,2)}%")

    st.write("### Details")
    for k, v in details.items():
        st.write(f"{k}: {round(v,2)}")

    # Risk Section
    st.write("### ⚠️ Risks")
    st.write("- Model uncertainty")
    st.write("- Market volatility")
    st.write("- Limited sentiment accuracy")

    # Contrarian View
    st.write("### 🤔 Contrarian View")
    st.write("Model may be wrong if sudden macro events or news shift sentiment rapidly.")