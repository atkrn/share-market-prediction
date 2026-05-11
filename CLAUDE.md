# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run the Streamlit app
streamlit run app.py

# Run with a specific port
streamlit run app.py --server.port 8501
```

After installing `textblob`, you may need to download its corpora:
```bash
python -m textblob.download_corpora
```

## Architecture

The entire application lives in a single file, `app.py`, structured as a Streamlit single-page app. There are no modules, classes, or separate files — all logic is flat functions called top-to-bottom.

**Data flow:**
1. `get_stock_data(ticker)` — fetches 2 years of OHLCV history, company `info` dict, and news headlines from Yahoo Finance via `yfinance`. Results are cached for 5 minutes via `@st.cache_data`.
2. `compute_technical(df)` — adds RSI, MACD, Bollinger Bands, SMAs (20/50/200), EMAs (12/26), volume ratio, ATR, daily returns and volatility as new columns on the DataFrame.
3. Two independent forecasting models run in parallel:
   - `arima_forecast(series)` — ARIMA(5,1,0) on the last 200 Close prices, returns a single next-step forecast.
   - `xgb_forecast(df)` — XGBoost regressor trained on 13 technical features with an 80/20 time-ordered split, predicts next-day Close.
   - The final forecast is the average of both.
4. Three scoring functions each return a float in `[0, 1]`:
   - `technical_score(df)` — scores 5 signals (RSI, MACD crossover, golden/death cross, price vs SMA20, volume conviction), normalises from raw range `[-3, 6]` to `[0, 1]`.
   - `fundamental_score(info)` — scores 5 criteria (ROE, debt/equity, profit margin, P/E, current ratio), returns fraction of passing criteria.
   - `sentiment_score(news)` — runs TextBlob polarity on up to 15 news titles, maps mean polarity from `[-1, 1]` to `[0, 1]`.
5. `final_decision(tech, fund, forecast, sentiment_norm, current_price)` — computes a weighted score (Technical 30%, Fundamental 25%, Forecast 25%, Sentiment 20%) and maps it to BUY (>0.62) / HOLD (0.42–0.62) / SELL (<0.42).

**UI rendering** happens entirely in the module-level code below the function definitions. It renders: header → ticker input → company metrics → BUY/HOLD/SELL recommendation panel → price chart (candlestick + Bollinger Bands + MAs + Volume + RSI) → MACD chart → fundamental data table → news feed with sentiment labels → risk warnings.

**Key thresholds to know when modifying scoring logic:**
- RSI oversold < 30, overbought > 70
- Technical score raw range is `[-3, 6]`, normalised by `(score + 3) / 9`
- BUY/HOLD/SELL cutoffs: 0.62 and 0.42
- Forecast score: `0.5 + pct_change * 10`, clamped to `[0, 1]`
