import pandas as pd
import numpy as np


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



class BiasDetector:
    def __init__(self, df):
        self.df = df.sort_values('timestamp')

    def detect_overtrading(self):
        self.df['hour'] = self.df['timestamp'].dt.to_period('h')
        max_trades_hour = self.df.groupby('hour').size().max()
        
        # LOGIC: 150 trades/hr is the "High Frequency" cutoff.
        threshold = 150
        is_overtrading = max_trades_hour > threshold
        return {
            "detected": bool(is_overtrading),
            "metric": f"{max_trades_hour} trades/hr (Limit: {threshold})",
            "summary": "Extreme trading frequency detected in short bursts." if is_overtrading else "Trade frequency is within normal limits."
        }

    def detect_loss_aversion(self):
        wins = self.df[self.df['profit_loss'] > 0]['profit_loss']
        losses = self.df[self.df['profit_loss'] < 0]['profit_loss'].abs()
        
        avg_win = wins.mean() if not wins.empty else 0
        avg_loss = losses.mean() if not losses.empty else 0
        
        # LOGIC: Losses must be 1.75x larger than wins to flag.
        ratio = avg_loss / avg_win if avg_win > 0 else 0
        is_averse = avg_loss > (avg_win * 1.75)
        
        return {
            "detected": bool(is_averse),
            "metric": f"Loss/Win Ratio: {round(ratio, 2)}x",
            "summary": "Your average losses are significantly larger than your winners." if is_averse else "Risk management is disciplined."
        }
    def get_equity_curve(self):
        """
        Returns account balance over time, ANNOTATED with detected biases.
        """
        # 1. Sort by time to ensure the graph draws correctly
        df = self.df.sort_values(by='time').copy()
        
        # 2. Calculate Running Total (Equity)
        df['equity'] = df['profit_loss'].cumsum()
        
        # 3. Initialize a 'bias' column (default is None)
        df['bias_event'] = None
        df['bias_color'] = None

        # --- TAG REVENGE TRADES (Red) ---
        # (Re-using the Z-Score logic here to tag specific rows)
        df['prev_pl'] = df['profit_loss'].shift(1)
        user_avg_size = df['quantity'].mean()
        user_std_dev = df['quantity'].std()
        
        if user_std_dev > 0:
            # Calculate Z-Score for every trade
            df['z_score'] = (df['quantity'] - user_avg_size) / user_std_dev
            
            # Mark trades that are huge (Z > 3) AND after a loss
            revenge_mask = (df['prev_pl'] < 0) & (df['z_score'] > 3)
            df.loc[revenge_mask, 'bias_event'] = "Revenge Trade"
            df.loc[revenge_mask, 'bias_color'] = "#ef4444" # Red

        # --- TAG LOSS AVERSION (Orange) ---
        # (Holding losers too long)
        # We look for trades with large negative PnL and long duration
        if 'duration' in df.columns:
            avg_win_duration = df[df['profit_loss'] > 0]['duration'].mean()
            # If a trade is a loss AND held 2x longer than average winners
            loss_aversion_mask = (df['profit_loss'] < 0) & (df['duration'] > (avg_win_duration * 2))
            # Only overwrite if not already marked as Revenge (Revenge takes priority)
            df.loc[loss_aversion_mask & df['bias_event'].isnull(), 'bias_event'] = "Loss Aversion"
            df.loc[loss_aversion_mask & df['bias_color'].isnull(), 'bias_color'] = "#f97316" # Orange

        # 4. Return data for the frontend
        # We replace NaN with None for valid JSON
        return df[['time', 'equity', 'bias_event', 'bias_color']].where(pd.notnull(df), None).to_dict(orient='records')
    def detect_revenge_trading(self):
        """
        ML APPROACH: Z-Score Anomaly Detection.
        Instead of a fixed multiplier (e.g. 3x), we ask:
        'Is this trade statistically an outlier for THIS specific user?'
        """
        # 1. Prepare Data
        self.df['prev_pl'] = self.df['profit_loss'].shift(1)
        
        # Filter for trades immediately following a loss
        loss_following_trades = self.df[self.df['prev_pl'] < 0].copy()
        
        if len(loss_following_trades) < 5:
            return {"detected": False, "metric": "Insufficient Data", "summary": "Not enough post-loss trades to analyze."}

        # 2. Calculate Statistics for THIS USER (Personalized Baseline)
        # We look at 'quantity' (position size)
        user_avg_size = self.df['quantity'].mean()
        user_std_dev = self.df['quantity'].std()
        
        if user_std_dev == 0:
            return {"detected": False, "metric": "Stable Sizing", "summary": "You never change your position size."}

        # 3. Calculate Z-Score for every post-loss trade
        # Z-Score = (Current Size - Average Size) / Standard Deviation
        # A Z-Score > 3 means this event is in the top 0.1% of 'weirdness' for this user.
        loss_following_trades['z_score'] = (loss_following_trades['quantity'] - user_avg_size) / user_std_dev
        
        # 4. Identify Anomalies (Revenge Trades)
        # We flag trades that are 3 standard deviations above the mean AND after a loss.
        anomalies = loss_following_trades[loss_following_trades['z_score'] > 3]
        anomaly_count = len(anomalies)
        
        # 5. Final Verdict
        # We only flag if these anomalies make up > 1% of their post-loss activity
        # This allows for the occasional 'fat finger' error without flagging bias.
        anomaly_ratio = anomaly_count / len(loss_following_trades)
        is_revenge = anomaly_ratio > 0.01

        return {
            "detected": bool(is_revenge),
            "metric": f"{anomaly_count} statistical outliers (Z-Score > 3)",
            "summary": "AI detected distinct spikes in risk that deviate from your normal baseline." if is_revenge else "Your risk sizing is statistically consistent, even after losses."
        }

    def detect_monte_carlo_fallacy(self):
        self.df['is_buy'] = self.df['side'].str.upper() == 'BUY'
        streaks = (self.df['is_buy'] != self.df['is_buy'].shift()).cumsum()
        streak_counts = self.df.groupby(streaks).size()
        max_streak = streak_counts.max()

        # Threshold: 15 consecutive buys/sells is rare even for algos.
        threshold = 15
        is_fallacy = max_streak >= threshold
        return {
            "detected": bool(is_fallacy),
            "metric": f"Max streak: {max_streak}",
            "summary": f"You bet in the same direction {max_streak} times in a row." if is_fallacy else "No irrational streak betting detected."
        }

    def detect_disposition_effect(self):
        wins = self.df[self.df['profit_loss'] > 0]
        losses = self.df[self.df['profit_loss'] < 0]
        
        # Stricter: Must have 5x more wins AND average win must be smaller than avg loss
        is_dispo = (len(wins) > len(losses) * 5) and (wins['profit_loss'].mean() < losses['profit_loss'].abs().mean())
        return {
            "detected": bool(is_dispo),
            "metric": "N/A",
            "summary": "Likely taking small profits quickly while letting losses run." if is_dispo else "No clear evidence of the disposition effect."
        }

    def detect_recency_bias(self):
        if len(self.df) < 10:
            return {"detected": False, "metric": "N/A", "summary": "Not enough data."}

        recent_volatility = self.df['quantity'].tail(5).std()
        historical_volatility = self.df['quantity'].std()

        ratio = recent_volatility / historical_volatility if historical_volatility > 0 else 0
        is_recency = ratio > 2.0

        return {
            "detected": bool(is_recency),
            "metric": f"Recent Volatility: {round(ratio, 2)}x",
            "summary": "Recent behavior is significantly more erratic than your baseline." if is_recency else "Recent behavior aligns with long-term consistency."
        }

    def get_radar_data(self):
        """
        Formats the bias results for the Radar Chart on the frontend.
        Maps 'detected' (True/False) to a score (100/20).
        """
        # Run analysis if it hasn't been run yet
        results = self.run_all_tests() if not hasattr(self, 'results') else self.results

        # Helper to convert boolean to score
        def get_score(key):
            # If the bias key exists and 'detected' is True, return 100 (High Bias)
            # Otherwise return 20 (Low Bias/Healthy)
            return 100 if results.get(key, {}).get('detected', False) else 20

        return [
            {"subject": "Overtrading", "A": get_score("overtrading"), "fullMark": 150},
            {"subject": "Loss Aversion", "A": get_score("loss_aversion"), "fullMark": 150},
            {"subject": "Revenge Trading", "A": get_score("revenge_trading"), "fullMark": 150},
            {"subject": "Disposition", "A": get_score("disposition"), "fullMark": 150},
            {"subject": "Monte Carlo", "A": get_score("monte_carlo"), "fullMark": 150},
            {"subject": "Recency Bias", "A": get_score("recency_bias"), "fullMark": 150},
        ]

   
    
    def get_equity_curve(self):
        """
        Returns the cumulative P&L (Equity Curve) with 'Bias Flags' for the chart.
        """
        # 1. Sort by time/index
        df = self.df.copy()
        if 'timestamp' in df.columns:
            df = df.sort_values(by='timestamp')
        
        # 2. Calculate Equity (Running Total of P/L)
        # If 'balance' is missing, we reconstruct it from profit_loss
        if 'balance' not in df.columns:
            start_balance = 0 # Or passed from user input
            df['equity'] = df['profit_loss'].cumsum() + start_balance
        else:
            df['equity'] = df['balance']

        # 3. DETECT BIAS EVENTS (For the Chart Markers)
        # Logic: If you trade > 2x your normal size immediately after a loss -> FLAG IT
        mean_size = df['quantity'].mean() if 'quantity' in df.columns else 0
        df['prev_pl'] = df['profit_loss'].shift(1)
        
        # Define the Bias Logic
        # (Revenge Trade = Loss on previous trade + Current trade is huge)
        revenge_mask = (df['prev_pl'] < 0) & (df['quantity'] > mean_size * 2)
        
        # Create a column for the chart tooltip
        df['bias_label'] = None
        df.loc[revenge_mask, 'bias_label'] = "Revenge Trade"

        # 4. Format for Frontend (Recharts)
        chart_data = []
        for index, row in df.iterrows():
            chart_data.append({
                "time": str(row['timestamp']) if 'timestamp' in row else f"Trade {index}",
                "equity": row['equity'],
                "bias": row['bias_label'],  # Will be 'Revenge Trade' or None
                "pnl": row['profit_loss']
            })
            
        return chart_data

    def run_all_tests(self):
        return {
            "overtrading": self.detect_overtrading(),
            "loss_aversion": self.detect_loss_aversion(),
            "revenge_trading": self.detect_revenge_trading(),
            "monte_carlo": self.detect_monte_carlo_fallacy(),
            "disposition": self.detect_disposition_effect(),
            "recency_bias": self.detect_recency_bias()
        }