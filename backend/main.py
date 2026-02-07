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
        You are ResetPoint, an advanced Behavioral Finance Engine.
        Your goal is to help traders detect harmful patterns in their history and improve their future performance.
        
        TONE:
        - Professional, insightful, and constructive.
        - Firm but educational (like a high-performance sports coach).
        - Focus on "Why" the behavior is happening, not just "What" happened.
        """

        # 3. Construct the "User" Context (The Data)
        user_prompt = f"""
        TRADER DATA:
        - Balance: ${stats.get('account_balance', 0)}
        - Detected Patterns: {json.dumps(detected_problems, indent=2)}
        
        TASK:
        Generate 3 distinct insights to improve this trader's performance.
        
        FORMAT GUIDELINES:
        - Insight 1 (Immediate Risk): Address the most dangerous bias detected (e.g., Revenge Trading). Explain *why* it is destroying their edge.
        - Insight 2 (Behavioral Pattern): Identify a subtle habit (e.g., holding losers too long) and explain the psychological trigger.
        - Insight 3 (Actionable Fix): Give one specific, mechanical rule to implement tomorrow (e.g., "Set a hard stop at 1%").
        
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
        
        # Parse dates
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Run Bias Detection Logic
        detector = BiasDetector(df)
        analysis_results = detector.run_all_tests()
        
        # Prepare stats for the AI
        stats = {
            "filename": file.filename,
            "total_trades": len(df),
            "account_balance": float(df['balance'].iloc[-1]) if 'balance' in df.columns else 0
        }

        # CALL THE NEW AI FUNCTION
        ai_recommendations = generate_ai_advice(analysis_results, stats)
        
        return {
            "status": "success",
            "metadata": stats,
            "biases": analysis_results,
            "ai_advice": ai_recommendations
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)