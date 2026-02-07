# =================================================================
# BIAS DETECTION ENGINE
# =================================================================

# 1. OVERTRADING: Excessive frequency relative to time and balance.
# 2. LOSS AVERSION: Holding losers too long; emotional attachment to bad trades.
# 3. REVENGE TRADING: Impulsive "size-up" immediately following a loss.
# 4. DISPOSITION EFFECT: Realizing small gains too early while letting losses run.
# 5. RECENCY BIAS: Over-weighting the most recent 5 trades to dictate future risk.
# 6. MONTE CARLO FALLACY: Betting on a "reversal" just because a trend has lasted "too long."

import pandas as pd
import numpy as np

class BiasDetector:
    def __init__(self, df):
        # Sorting by timestamp is critical for time-based clustering analysis [cite: 36]
        self.df = df.sort_values('timestamp')

    # --- Core Biases Required by Challenge ---

    def detect_overtrading(self):
        """Analyze excessive number of trades and time-based clustering[cite: 31, 36]."""
        self.df['hour'] = self.df['timestamp'].dt.to_period('H')
        max_trades_hour = self.df.groupby('hour').size().max()
        
        # Threshold: 5+ trades an hour is often considered impulsive for retail [cite: 36]
        is_overtrading = max_trades_hour > 5 
        return {
            "detected": bool(is_overtrading),
            "metric": f"{max_trades_hour} trades/hr",
            "summary": "You are trading too frequently in short bursts." if is_overtrading else "Trade frequency is disciplined."
        }

    def detect_loss_aversion(self):
        """Identify higher average loss size than average win size[cite: 38, 43]."""
        wins = self.df[self.df['profit_loss'] > 0]['profit_loss']
        losses = self.df[self.df['profit_loss'] < 0]['profit_loss'].abs()
        
        avg_win = wins.mean() if not wins.empty else 0
        avg_loss = losses.mean() if not losses.empty else 0
        
        is_averse = avg_loss > (avg_win * 1.2)
        return {
            "detected": bool(is_averse),
            "ratio": round(avg_loss / avg_win, 2) if avg_win > 0 else 0,
            "summary": "Your losses are significantly larger than your wins." if is_averse else "Your risk/reward ratio is healthy."
        }

    def detect_revenge_trading(self):
        """Identify increased risk-taking immediately after a loss[cite: 45, 47, 48]."""
        self.df['prev_pl'] = self.df['profit_loss'].shift(1)
        self.df['prev_qty'] = self.df['quantity'].shift(1)
        
        # Detected if quantity increases by 50% immediately following a negative P/L [cite: 47]
        revenge_mask = (self.df['prev_pl'] < 0) & (self.df['quantity'] > self.df['prev_qty'] * 1.5)
        is_revenge = revenge_mask.any()
        
        return {
            "detected": bool(is_revenge),
            "summary": "You tend to increase trade size to 'win back' losses." if is_revenge else "You maintain steady sizing after a loss."
        }

    # --- Advanced Biases for Extra Credit [cite: 65] ---

    def detect_monte_carlo_fallacy(self):
        """The belief that a streak of one side (e.g., BUYs) makes a reversal (SELL) more likely."""
        self.df['is_buy'] = self.df['side'].str.upper() == 'BUY'
        # Grouping consecutive same-side trades
        streaks = (self.df['is_buy'] != self.df['is_buy'].shift()).cumsum()
        streak_counts = self.df.groupby(streaks).size()
        
        # If a user opens 4+ trades in the same direction, they may be 'betting' on a reversal
        is_fallacy = streak_counts.max() >= 4
        return {
            "detected": bool(is_fallacy),
            "max_streak": int(streak_counts.max()),
            "summary": "You may be stubbornly betting on a trend reversal." if is_fallacy else "Position switching looks rational."
        }

    def detect_disposition_effect(self):
        """Holding losing trades run too long while closing winners too early[cite: 40, 41]."""
        # Note: In a real app, this would use entry/exit timestamps to find 'duration'
        # For this mockup, we flag if the user has many more small wins than large losses.
        wins = self.df[self.df['profit_loss'] > 0]
        losses = self.df[self.df['profit_loss'] < 0]
        
        is_dispo = len(wins) > (len(losses) * 2) and wins['profit_loss'].mean() < losses['profit_loss'].abs().mean()
        return {
            "detected": bool(is_dispo),
            "summary": "You are 'cutting your flowers and watering your weeds'." if is_dispo else "You exit trades based on strategy, not fear."
        }

    def run_all_tests(self):
        """Consolidate results for the Next.js frontend to display[cite: 55, 57]."""
        return {
            "overtrading": self.detect_overtrading(),
            "loss_aversion": self.detect_loss_aversion(),
            "revenge_trading": self.detect_revenge_trading(),
            "monte_carlo": self.detect_monte_carlo_fallacy(),
            "disposition": self.detect_disposition_effect()
        }