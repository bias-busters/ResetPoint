import pandas as pd
import numpy as np
import math


"""
BEHAVIORAL BIAS DEFINITIONS
---------------------------

1. OVERTRADING
   Definition: Excessive buying and selling triggered by emotion (boredom, excitement) rather than statistical edge.
   Detection Logic: High trade frequency within short time windows (e.g., >10 trades/hour).

2. LOSS AVERSION
   Definition: The psychological tendency to prefer avoiding losses to acquiring equivalent gains.
   Detection Logic: Win/Loss ratio < 1.0 (trader takes small profits but holds large losses).
   
3. REVENGE TRADING
   Definition: An emotional attempt to force the market to return lost capital immediately after a drawdown.
   Detection Logic: significantly increased volume or frequency immediately following a loss.

4. DISPOSITION EFFECT
   Definition: The tendency to sell winning positions too early (to lock in certainty) while holding losing positions too long (hoping for a rebound).
   Detection Logic: Average duration of losing trades > Average duration of winning trades.

5. GAMBLER'S FALLACY (MONTE CARLO BIAS)
   Definition: The erroneous belief that a streak of independent events increases the probability of a reversal (e.g., "It's been Green 5 times, it MUST be Red next").
   Detection Logic: Betting against the trend after a streak of N consecutive candles/trades.

6. RECENCY BIAS
   Definition: Overweighting the significance of the most recent data while ignoring long-term historical probabilities.
   Detection Logic: Drastic changes in risk sizing based solely on the outcome of the last 3-5 trades.
"""

import pandas as pd
import numpy as np
import math

class BiasDetector:
    def __init__(self, df):
        # Ensure we have data and sort it
        self.df = df.sort_values('timestamp') if not df.empty else df
        
        # Clean data: Replace infinite or NaN values in numeric columns with 0
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns
        self.df[numeric_cols] = self.df[numeric_cols].fillna(0)
        
        # Create helper columns if missing
        if 'duration' not in self.df.columns and 'close_time' in self.df.columns:
             self.df['duration'] = (pd.to_datetime(self.df['close_time']) - pd.to_datetime(self.df['timestamp'])).dt.total_seconds()

    def _safe_float(self, value):
        """Helper to ensure we never return NaN or Infinity to JSON"""
        if pd.isna(value) or math.isinf(value):
            return 0.0
        return float(value)

    def _format_example(self, row, reason):
        """Standardizes the evidence format for the frontend"""
        return {
            "trade_id": str(row.name),
            "date": str(row['timestamp']) if 'timestamp' in row else "N/A",
            "pnl": self._safe_float(row['profit_loss']) if 'profit_loss' in row else 0,
            "reason": reason
        }

    def detect_overtrading(self):
        if self.df.empty:
             return {"detected": False, "metric": "No Data", "summary": "Insufficient data.", "examples": []}

        # Safe datetime conversion
        self.df['hour'] = self.df['timestamp'].dt.to_period('h')
        hourly_counts = self.df.groupby('hour').size()
        
        if hourly_counts.empty:
             max_trades_hour = 0
        else:
             max_trades_hour = hourly_counts.max()
        
        # Threshold: 150 trades/hr
        threshold = 150
        is_overtrading = max_trades_hour > threshold
        
        # Collect Examples
        examples = []
        if is_overtrading:
            # Find the specific hours that went over the limit
            bad_hours = hourly_counts[hourly_counts > threshold]
            for hour, count in bad_hours.head(3).items():
                examples.append({
                    "date": str(hour),
                    "metric": f"{count} trades",
                    "reason": f"Exceeded limit of {threshold} trades/hr",
                    "context": "High Frequency Burst"
                })

        return {
            "detected": bool(is_overtrading),
            "metric": f"{max_trades_hour} trades/hr (Limit: {threshold})",
            "summary": "Extreme trading frequency detected in short bursts." if is_overtrading else "Trade frequency is within normal limits.",
            "examples": examples
        }

    def detect_loss_aversion(self):
        if self.df.empty:
             return {"detected": False, "metric": "No Data", "summary": "Insufficient data.", "examples": []}

        wins = self.df[self.df['profit_loss'] > 0]
        losses = self.df[self.df['profit_loss'] < 0]
        
        avg_win = wins['profit_loss'].mean() if not wins.empty else 0.0
        avg_loss = losses['profit_loss'].abs().mean() if not losses.empty else 0.0
        
        if avg_win > 0:
            ratio = avg_loss / avg_win
        else:
            ratio = 0.0
            
        is_averse = avg_loss > (avg_win * 1.75)
        
        # Collect Examples: Losers held too long or simply too big
        examples = []
        if is_averse:
            # Find the biggest losses that are driving this ratio
            bad_losses = losses.sort_values('profit_loss').head(5)
            for idx, row in bad_losses.iterrows():
                examples.append(self._format_example(row, f"Loss is {round(abs(row['profit_loss'])/avg_win, 1)}x your average win"))

        return {
            "detected": bool(is_averse),
            "metric": f"Loss/Win Ratio: {round(self._safe_float(ratio), 2)}x",
            "summary": "Your average losses are significantly larger than your winners." if is_averse else "Risk management is disciplined.",
            "examples": examples
        }

    def detect_revenge_trading(self):
        if self.df.empty:
             return {"detected": False, "metric": "No Data", "summary": "Insufficient Data", "examples": []}

        self.df['prev_pl'] = self.df['profit_loss'].shift(1)
        loss_following_trades = self.df[self.df['prev_pl'] < 0].copy()
        
        if len(loss_following_trades) < 5:
            return {"detected": False, "metric": "Insufficient Data", "summary": "Not enough data.", "examples": []}

        user_avg_size = self.df['quantity'].mean()
        user_std_dev = self.df['quantity'].std()
        
        if pd.isna(user_std_dev) or user_std_dev == 0:
            return {"detected": False, "metric": "Stable Sizing", "summary": "Consistent sizing.", "examples": []}

        # Z-Score Calculation
        loss_following_trades['z_score'] = (loss_following_trades['quantity'] - user_avg_size) / user_std_dev
        
        # Identify Anomalies: > 3 std devs AND > 2x average size (to avoid low variance noise)
        anomalies = loss_following_trades[
            (loss_following_trades['z_score'] > 3) & 
            (loss_following_trades['quantity'] > user_avg_size * 2)
        ]
        
        anomaly_count = len(anomalies)
        is_revenge = anomaly_count > 0 # Strict detection for now

        # Collect Examples
        examples = []
        for idx, row in anomalies.head(5).iterrows():
            examples.append(self._format_example(row, f"Size: {row['quantity']} (Avg: {round(user_avg_size, 1)}) after Loss"))

        return {
            "detected": bool(is_revenge),
            "metric": f"{anomaly_count} statistical outliers",
            "summary": "AI detected spikes in risk immediately after losses." if is_revenge else "Risk sizing is consistent after losses.",
            "examples": examples
        }

    def detect_monte_carlo_fallacy(self):
        if self.df.empty:
             return {"detected": False, "metric": "No Data", "summary": "Insufficient Data", "examples": []}

        self.df['is_buy'] = self.df['side'].astype(str).str.upper() == 'BUY'
        streaks = (self.df['is_buy'] != self.df['is_buy'].shift()).cumsum()
        
        # Group by streak ID to find lengths
        streak_groups = self.df.groupby(streaks)
        streak_counts = streak_groups.size()
        
        if streak_counts.empty:
            max_streak = 0
        else:
            max_streak = streak_counts.max()

        threshold = 15
        is_fallacy = max_streak >= threshold
        
        # Collect Examples
        examples = []
        if is_fallacy:
            # Find the long streaks
            long_streaks = streak_counts[streak_counts >= threshold].head(3)
            for streak_id, length in long_streaks.items():
                # Get the first trade of this streak to grab the date
                streak_data = streak_groups.get_group(streak_id)
                first_trade = streak_data.iloc[0]
                direction = "BUY" if first_trade['is_buy'] else "SELL"
                
                examples.append({
                    "date": str(first_trade['timestamp']),
                    "metric": f"{length} Consecutive {direction}s",
                    "reason": "Probabilistic anomaly (Gambler's Fallacy)",
                    "context": "Trend/Streak"
                })

        return {
            "detected": bool(is_fallacy),
            "metric": f"Max streak: {max_streak}",
            "summary": f"You bet in the same direction {max_streak} times in a row." if is_fallacy else "No irrational streak betting detected.",
            "examples": examples
        }

    def detect_disposition_effect(self):
        if self.df.empty: return {"detected": False, "metric": "N/A", "summary": "No Data", "examples": []}

        wins = self.df[self.df['profit_loss'] > 0]
        losses = self.df[self.df['profit_loss'] < 0]
        
        if wins.empty or losses.empty:
             return {"detected": False, "metric": "N/A", "summary": "Insufficient win/loss data.", "examples": []}

        avg_win_pl = wins['profit_loss'].mean()
        avg_loss_pl = losses['profit_loss'].abs().mean()
        
        is_dispo = (len(wins) > len(losses) * 5) and (avg_win_pl < avg_loss_pl)
        
        # Collect Examples: Winners sold too small
        examples = []
        if is_dispo:
            tiny_wins = wins.sort_values('profit_loss').head(5)
            for idx, row in tiny_wins.iterrows():
                 examples.append(self._format_example(row, f"Profit: ${round(row['profit_loss'], 2)} (Avg Loss: ${round(avg_loss_pl, 2)})"))

        return {
            "detected": bool(is_dispo),
            "metric": "N/A",
            "summary": "Likely taking small profits quickly while letting losses run." if is_dispo else "No clear evidence of the disposition effect.",
            "examples": examples
        }

    def detect_recency_bias(self):
        if len(self.df) < 10:
            return {"detected": False, "metric": "N/A", "summary": "Not enough data.", "examples": []}

        recent_volatility = self.df['quantity'].tail(5).std()
        historical_volatility = self.df['quantity'].std()

        if pd.isna(recent_volatility): recent_volatility = 0.0
        if pd.isna(historical_volatility): historical_volatility = 0.0

        if historical_volatility > 0:
            ratio = recent_volatility / historical_volatility
        else:
            ratio = 0.0
            
        is_recency = ratio > 2.0
        
        # Collect Examples: The recent volatile trades
        examples = []
        if is_recency:
            recent_trades = self.df.tail(5)
            for idx, row in recent_trades.iterrows():
                examples.append(self._format_example(row, f"Size: {row['quantity']} (Hist Vol: {round(historical_volatility, 2)})"))

        return {
            "detected": bool(is_recency),
            "metric": f"Recent Volatility: {round(self._safe_float(ratio), 2)}x",
            "summary": "Recent behavior is significantly more erratic than your baseline." if is_recency else "Recent behavior aligns with long-term consistency.",
            "examples": examples
        }

    def run_all_tests(self):
        self.results = {
            "overtrading": self.detect_overtrading(),
            "loss_aversion": self.detect_loss_aversion(),
            "revenge_trading": self.detect_revenge_trading(),
            "monte_carlo": self.detect_monte_carlo_fallacy(),
            "disposition": self.detect_disposition_effect(),
            "recency_bias": self.detect_recency_bias()
        }
        return self.results
    
    # ... (Keep get_radar_data and get_equity_curve as they were) ...
    def get_radar_data(self):
        # Run analysis if it hasn't been run yet
        results = self.run_all_tests() if not hasattr(self, 'results') else self.results

        def get_score(key):
            return 100 if results.get(key, {}).get('detected', False) else 20

        return [
            {"subject": "Overtrading", "A": get_score("overtrading"), "fullMark": 150},
            {"subject": "Loss Aversion", "A": get_score("loss_aversion"), "fullMark": 150},
            {"subject": "Revenge", "A": get_score("revenge_trading"), "fullMark": 150}, 
            {"subject": "Disposition", "A": get_score("disposition"), "fullMark": 150},
            {"subject": "Monte Carlo", "A": get_score("monte_carlo"), "fullMark": 150},
            {"subject": "Recency", "A": get_score("recency_bias"), "fullMark": 150}, 
        ]

    def get_equity_curve(self):
        if self.df.empty: return []
        df = self.df.copy()
        if 'timestamp' in df.columns:
            df = df.sort_values(by='timestamp')
        if 'balance' not in df.columns:
            start_balance = 0 
            df['equity'] = df['profit_loss'].cumsum() + start_balance
        else:
            df['equity'] = df['balance']

        mean_size = df['quantity'].mean() if 'quantity' in df.columns else 0
        df['prev_pl'] = df['profit_loss'].shift(1)
        revenge_mask = (df['prev_pl'] < 0) & (df['quantity'] > mean_size * 2)
        df['bias_label'] = None
        df.loc[revenge_mask, 'bias_label'] = "Revenge Trade"

        chart_data = []
        for index, row in df.iterrows():
            chart_data.append({
                "time": str(row['timestamp']) if 'timestamp' in row else f"Trade {index}",
                "equity": self._safe_float(row['equity']),
                "bias": row['bias_label'], 
                "pnl": self._safe_float(row['profit_loss'])
            })
        return chart_data