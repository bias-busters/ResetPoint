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

def generate_ai_advice(biases, stats):
    """
    Sends the detected bias data to OpenRouter (DeepSeek/Llama/Claude)
    and returns 3 specific, actionable coaching tips.
    """
    try:
        # 1. Construct the Prompt
        # We summarize the detected issues into a string
        detected_issues = [k for k, v in biases.items() if v['detected']]
        
        if not detected_issues:
            return ["✨ Your trading psychology is excellent. No major biases detected.", 
                    "✅ Maintain your current risk management protocols.", 
                    "📈 Focus on scaling up size slowly as your edge is confirmed."]

        prompt = f"""
        You are a harsh but effective Trading Psychology Coach like Wendy Rhoades from Billions.
        
        USER STATS:
        - Account Balance: ${stats['account_balance']}
        - Total Trades: {stats['total_trades']}
        - DETECTED BIASES: {", ".join(detected_issues)}
        
        DATA CONTEXT:
        {json.dumps(biases, indent=2)}

        TASK:
        Provide exactly 3 extremely specific, actionable rules for this trader to fix their mind.
        Do not be generic. Be strict.
        
        FORMAT:
        Return ONLY a raw JSON list of strings. Example: ["Rule 1...", "Rule 2...", "Rule 3..."]
        """

        # 2. Call OpenRouter
        # 'deepseek/deepseek-r1' is great for logic, or 'meta-llama/llama-3.3-70b-instruct' for speed.
        completion = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": os.getenv("YOUR_SITE_URL"),
                "X-Title": os.getenv("YOUR_SITE_NAME"),
            },
            model="deepseek/deepseek-r1:free", # OR "meta-llama/llama-3.3-70b-instruct"
            messages=[
                {"role": "system", "content": "You are an expert behavioral finance analyst. Output JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
        )

        # 3. Parse Response
        content = completion.choices[0].message.content
        
        # Clean up code blocks if the AI adds them (e.g. ```json ... ```)
        if "```" in content:
            content = content.split("```")[1].replace("json", "").strip()
            
        return json.loads(content)

    except Exception as e:
        print(f"AI Error: {e}")
        return [
            "⚠️ AI Connection Failed: Using fallback advice.",
            "1. Implement a hard stop-loss at 1% of equity per trade.",
            "2. Stop trading for the day if you lose 3 trades in a row."
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