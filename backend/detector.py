import pandas as pd
import numpy as np

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

    def run_all_tests(self):
        return {
            "overtrading": self.detect_overtrading(),
            "loss_aversion": self.detect_loss_aversion(),
            "revenge_trading": self.detect_revenge_trading(),
            "monte_carlo": self.detect_monte_carlo_fallacy(),
            "disposition": self.detect_disposition_effect(),
            "recency_bias": self.detect_recency_bias()
        }