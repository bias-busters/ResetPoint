import os
import json
import pandas as pd
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from dotenv import load_dotenv
from detector import BiasDetector

# Load API Key from .env
load_dotenv()

app = FastAPI()

# Allow frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SETUP OPENROUTER CLIENT
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

from openai import OpenAI, RateLimitError # Make sure RateLimitError is imported at the top of your file

def generate_ai_advice(biases, stats):
    """
    Sends data to OpenRouter with a 'Behavioral Finance Coach' persona.
    Returns 3 specific, educational, and actionable tips.
    """
    try:
        # 1. Filter for only the detected problems to save token space & focus attention
        detected_problems = {k: v for k, v in biases.items() if v.get('detected', False)}
        
        # If no problems, return praise
        if not detected_problems:
            return [
                "✨ Performance Check: Your psychology is clean. No major biases detected.",
                "✅ Discipline: Maintain your current risk management protocols.",
                "📈 Next Step: Focus on scaling up position size slowly as your edge is confirmed."
            ]

        # 2. Construct the "System" Persona (The Behavioral Coach)
        system_instruction = """
        You are ResetPoint, a Behavioral Finance Analysis Engine designed to improve trading performance by identifying cognitive and emotional biases in trader behavior.

        Your primary function is to:
        - Detect statistically and behaviorally significant trading biases (e.g., overtrading, revenge trading, loss aversion, recency bias).
        - Explain the underlying psychological mechanism driving each bias.
        - Translate insights into concrete, rule-based interventions that reduce future risk.

        TONE & STYLE:
        - Professional, precise, and evidence-based.
        - Direct but non-judgmental (diagnostic, not punitive).
        - Insight-driven: prioritize explaining *why* the behavior occurs and *how* it degrades decision quality.
        - Action-oriented: every insight must lead to a measurable behavioral adjustment.

        GUIDING PRINCIPLES:
        - Focus on behavior, not character.
        - Avoid generic advice or motivational language.
        - Treat trading errors as system failures, not personal flaws.

        """

        # 3. Construct the "User" Context (The Data)
        user_prompt = f"""
        TRADER DATA:
        - Balance: ${stats.get('account_balance', 0)}
        - Detected Patterns: {json.dumps(detected_problems, indent=2)}
        
        OBJECTIVE:
        Generate 3 distinct high-impact insights to improve this trader's future performance by addressing detected behavioral biases.
        
        FORMAT GUIDELINES:
        - Insight 1 (Immediate Risk): Identify the most performance-damaging bias currently present (e.g., Revenge Trading). Explain *why* it is destroying their edge.
        - Insight 2 (Behavioral Pattern): Identify and explain the psychological trigger (e.g., emotional regulation failure, outcome fixation). Explain the cognitive bias involved (e.g., loss aversion, recency bias, confirmation bias). Connect the behavior to a flawed decision-making process. 
        - Insight 3 (Actionable Fix): Propose ONE specific, mechanical rule the trader can implement immediately. The rule must be objective, enforceable, and behavior-focused (not emotional). Avoid vague advice; use clear thresholds, limits, or conditions. 
        
        RESPONSE CONSTRAINTS:
        - Do NOT use generic warnings or motivational statements.
        - Do NOT shame or moralize the trader’s behavior.
        - Do NOT suggest stopping trading entirely unless explicitly justified by the data.

        BAD RESPONSE:
        ["Stop trading now.", "You are losing money.", "Be more careful."]
        
        GOOD RESPONSE:
        [
            "⚠️ Pattern Detected: You are 'Revenge Trading' after losses. This indicates you are trading your P&L, not the chart. Walk away for 2 hours.",
            "📉 Disposition Bias: You hold losing trades 3x longer than winners. You are hoping for a rebound instead of accepting the loss.",
            "✅ Action Plan: Implement a '2-Strike Rule'. If you lose 2 trades in a row, force a 60-minute break to reset your mental state."
        ]
        
        OUTPUT FORMAT:
        Return ONLY a raw JSON list of 3 strings.
        """

        # 4. Call OpenRouter
        completion = client.chat.completions.create(
            model="deepseek/deepseek-chat", # Smart, cheap, and reliable
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.72,
            extra_headers={
                "HTTP-Referer": os.getenv("YOUR_SITE_URL"),
                "X-Title": os.getenv("YOUR_SITE_NAME"),
            }
        )

        # 5. Parse Response
        content = completion.choices[0].message.content
        
        # Clean up markdown code blocks if present
        if "```" in content:
            content = content.split("```")[1].replace("json", "").strip()
            
        print("\n🤖 AI Advice Generated Successfully.\n")
        return json.loads(content)

    except RateLimitError:
        print("\n⚠️  QUOTA ERROR: OpenRouter credits exhausted (Error 402).")
        print("   -> Using fallback advice to keep app running.\n")
        return [
            "⚠️ AI Usage Limit Reached: Please check API credits.",
            "📉 Critical Risk: Implement a hard stop-loss at 1% of equity per trade.",
            "🛑 Circuit Breaker: Stop trading for the day if you lose 3 trades in a row."
        ]

    except Exception as e:
        print(f"AI Error: {e}")
        # Return clean, professional fallback advice so the UI looks good
        return [
            "📉 Market Volatility Protocol: Reduce your position size by 50% immediately.",
            "🛑 Circuit Breaker: If you lose 2 trades in a row today, stop trading for 1 hour.",
            "🧠 Psychological Reset: Your metrics show stress. Switch to demo trading for the next session."
        ]
@app.post("/analyze")
async def analyze_trading_data(file: UploadFile = File(...)):
    try:
        # Read the CSV file
        df = pd.read_csv(file.file)
        
        # Ensure standard column names (lower case)
        df.columns = df.columns.str.lower()

        #Ensure data is sorted
        timestamps = df.sort_values("timestamp")   #by garv

        # Calculate net profit as final balance minus initial balance   --->   #by garv
        if 'balance' in df.columns and len(timestamps) > 0:
            initial_balance = timestamps['balance'].iloc[0]
            final_balance = timestamps['balance'].iloc[-1]
            net_profit = float(final_balance - initial_balance)
        else:
            net_profit = 0.0
        
        # Parse dates
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Run Bias Detection Logic
        detector = BiasDetector(df)
        analysis_results = detector.run_all_tests()
        
        # Assuming analyze_behavior() returns the dictionary of detected biases
        # If your detector uses run_all_tests(), ensure it returns the dict format expected by the AI
        biases_result = detector.run_all_tests()
        # Prepare stats for the AI
        stats = {
            "filename": file.filename,
            "total_trades": len(df),
            "account_balance": float(df['balance'].iloc[-1]) if 'balance' in df.columns else 0,
            "net_profit": net_profit #Garvellia added this
        }

        # CALL THE AI FUNCTION
        ai_recommendations = generate_ai_advice(biases_result, stats)
        
        return {
            "status": "success",
            "metadata": stats,
            "biases": biases_result,
            "radar_chart": detector.get_radar_data(), # Ensure these methods exist in your Class
            "equity_curve": detector.get_equity_curve(), 
            "ai_advice": ai_recommendations # <--- FIXED: Use the variable, don't call the class method
        }

    except Exception as e:
        print(f"Server Error: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)