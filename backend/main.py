# API Entry Point: Receive CSV from the fronted and returns JSON result

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
from detector import BiasDetector

app = FastAPI(title="ResetPoint Bias Engine")

# 1. ENABLE CORS: Crucial so Next.js (port 3000) can talk to FastAPI (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze")
async def analyze_trading_data(file: UploadFile = File(...)):
    # Validate file type - helps with 'Performance' and 'Scalability' [cite: 74, 75]
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Please upload a valid CSV file.")

    try:
        # 2. READ DATA: Efficiently read the CSV into memory [cite: 74]
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        # 3. DATA PREP: Required for 'Time-based clustering' analysis [cite: 36]
        # Fields like Timestamp, P/L, and Quantity are essential [cite: 18, 21, 23]
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # 4. RUN ALL BIASES: Now including your new advanced logic [cite: 65]
        detector = BiasDetector(df)
        analysis_results = detector.run_all_tests()
        
        # 5. RESPONSE: Deliver structured JSON for the 'Innovative UI' [cite: 81]
        return {
            "status": "success",
            "metadata": {
                "filename": file.filename,
                "total_trades": len(df),
                "account_balance": float(df['balance'].iloc[-1]) if 'balance' in df.columns else 0 # [cite: 24]
            },
            "biases": analysis_results
        }

    except Exception as e:
        # Meaningful error signals for 'Behavioral Finance Insight' [cite: 88]
        raise HTTPException(status_code=500, detail=f"Engine Error: {str(e)}")