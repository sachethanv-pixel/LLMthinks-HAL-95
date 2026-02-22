# Diagnostic prints for Cloud Run debugging
import os
from dotenv import load_dotenv

print("--- TradeSage AI Starting Up ---")
print(f"[LOG] Process PID: {os.getpid()}")
print(f"[LOG] Current Working Directory: {os.getcwd()}")

# Load environment variables cautiously
if os.path.exists(".env"):
    print("[LOG] Found .env file, loading...")
    load_dotenv()
else:
    print("[LOG] No .env file found, relying on system environment variables.")

# Check CRITICAL API keys
keys_to_check = ["ALPHA_VANTAGE_API_KEY", "FMP_API_KEY", "NEWS_API_KEY", "PROJECT_ID"]
for key in keys_to_check:
    val = os.getenv(key)
    status = "[PRESENT]" if val else "[MISSING]"
    if val and len(val) > 4:
        masked = val[:2] + "*" * (len(val)-4) + val[-2:]
        print(f"[LOG] {key}: {status} ({masked})")
    else:
        print(f"[LOG] {key}: {status}")

# CRITICAL: Clear stale GCP credentials path if it doesn't exist
gcp_creds = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if gcp_creds and not os.path.exists(gcp_creds):
    print(f"[CLEAN] Clearing invalid GOOGLE_APPLICATION_CREDENTIALS path: {gcp_creds}")
    os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)

print("[LOG] Importing orchestrator...")
try:
    from app.adk.orchestrator import orchestrator
    print("[OK] Orchestrator import successful")
except Exception as e:
    print(f"[ERROR] CRITICAL ERROR importing orchestrator: {str(e)}")
    import traceback
    traceback.print_exc()
    # Create dummy orchestrator to avoid crash during import by uvicorn
    orchestrator = None

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import asyncio
from datetime import datetime
from typing import Dict, Any, List
import re
import os
from dotenv import load_dotenv

from app.database.database import get_db
from app.database.crud import DashboardCRUD, HypothesisCRUD, ContradictionCRUD, ConfirmationCRUD, AlertCRUD, PriceHistoryCRUD
from app.utils.text_processor import ResponseProcessor

def _extract_target_price(thesis: str) -> float:
    """Simple regex to extract target price from thesis statement."""
    # Look for $ followed by numbers
    match = re.search(r'\$(\d+(?:\.\d+)?)', thesis)
    if match:
        try:
            return float(match.group(1))
        except:
            pass
    return 0

app = FastAPI(title="TradeSage AI - ADK Version", version="2.0.0")

# ── Resolve frontend build directory (local dev OR Docker container) ──
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_local_build = os.path.abspath(os.path.join(_THIS_DIR, "..", "..", "frontend", "build"))
FRONTEND_BUILD = (
    "/app/frontend_build"             # Docker: COPY frontend/build /app/frontend_build
    if os.path.isdir("/app/frontend_build")
    else _local_build                 # Local dev: <project_root>/frontend/build
)
print(f"[LOG] Frontend build: {'found' if os.path.isdir(FRONTEND_BUILD) else 'NOT FOUND'} at {FRONTEND_BUILD}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request, call_next):
    print(f"DEBUG: Incoming {request.method} request to {request.url.path}")
    response = await call_next(request)
    print(f"DEBUG: Response status: {response.status_code}")
    return response

@app.get("/")
async def root():
    """Serve React app if built, otherwise return API info."""
    index_path = os.path.join(FRONTEND_BUILD, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return {"message": "TradeSage AI - Google ADK v1.0.0 Implementation"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "tradesage-ai-adk", "version": "2.0.0"}

@app.post("/process")
async def process_hypothesis_adk(request_data: dict, db: Session = Depends(get_db)):
    """Process trading hypothesis using ADK agents."""
    
    try:
        # Extract input (handle different modes from frontend)
        hypothesis = request_data.get("hypothesis") or request_data.get("idea") or request_data.get("context") or ""
        mode = request_data.get("mode", "analyze")
        
        if not hypothesis:
            raise HTTPException(status_code=400, detail="No input text provided (hypothesis, idea, or context)")
        
        print(f"🚀 Processing with ADK: {hypothesis}")
        
        # Process through ADK orchestrator
        result = await orchestrator.process_hypothesis({
            "hypothesis": hypothesis,
            "mode": mode
        })
        
        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        # Clean and save to database
        clean_title = ResponseProcessor.clean_hypothesis_title(
            result.get("processed_hypothesis", hypothesis)
        )
        
        # Extract instruments from context
        instruments = result.get("context", {}).get("asset_info", {}).get("primary_symbol")
        if not instruments:
            instruments = ["SPY"]
        elif isinstance(instruments, str):
            instruments = [instruments]
            
        hypothesis_data = {
            "title": clean_title,
            "description": hypothesis,
            "thesis": result.get("processed_hypothesis", hypothesis),
            "confidence_score": result.get("confidence_score", 0.5),
            "status": "active",
            "created_at": datetime.utcnow(),
            "instruments": instruments,
            "current_price": result.get("metadata", {}).get("price", 0),
            "target_price": _extract_target_price(result.get("processed_hypothesis", ""))
        }
        
        db_hypothesis = HypothesisCRUD.create_hypothesis(db, hypothesis_data)
        
        # Save price history for trend charts
        tool_results = result.get("research_data", {}).get("tool_results", {})
        print(f"📊 Processing {len(tool_results)} tool results for history...")
        for tool_name, tool_result in tool_results.items():
            if isinstance(tool_result, dict) and 'price_history' in tool_result:
                symbol = tool_result.get('instrument', 'Unknown')
                history = tool_result.get('price_history', [])
                print(f"   📈 Saving {len(history)} price points for {symbol}")
                for entry in history:
                    try:
                        # Convert date string to datetime
                        date_str = entry["date"]
                        if 'T' in date_str:
                            timestamp = datetime.fromisoformat(date_str)
                        else:
                            timestamp = datetime.strptime(date_str, "%Y-%m-%d")
                            
                        price_data = {
                            "hypothesis_id": db_hypothesis.id,
                            "symbol": symbol,
                            "price": entry["price"],
                            "volume": entry["volume"],
                            "timestamp": timestamp
                        }
                        PriceHistoryCRUD.create_price_entry(db, price_data)
                    except Exception as e:
                        print(f"      ⚠️  Failed to save price history entry: {str(e)}")
            else:
                print(f"   ℹ️  Tool result for {tool_name} does not contain price_history")
        
        # Save contradictions with validation
        cleaned_contradictions = []
        for contradiction in result.get("contradictions", []):
            if isinstance(contradiction, dict):
                try:
                    # Ensure database field limits
                    contradiction_data = {
                        "hypothesis_id": db_hypothesis.id,
                        "quote": contradiction.get("quote", "")[:500],
                        "reason": contradiction.get("reason", "Market analysis challenges this thesis")[:500],
                        "source": contradiction.get("source", "Agent Analysis")[:500],
                        "strength": contradiction.get("strength", "Medium")
                    }
                    ContradictionCRUD.create_contradiction(db, contradiction_data)
                    cleaned_contradictions.append(contradiction.get("quote", ""))
                except Exception as e:
                    print(f"⚠️  Failed to save contradiction: {str(e)}")
                    continue
        
        # Save confirmations with validation
        cleaned_confirmations = []
        for confirmation in result.get("confirmations", []):
            if isinstance(confirmation, dict):
                try:
                    # Ensure database field limits
                    confirmation_data = {
                        "hypothesis_id": db_hypothesis.id,
                        "quote": confirmation.get("quote", "")[:500],
                        "reason": confirmation.get("reason", "Market analysis supports this thesis")[:500],
                        "source": confirmation.get("source", "Agent Analysis")[:500],
                        "strength": confirmation.get("strength", "Strong")
                    }
                    ConfirmationCRUD.create_confirmation(db, confirmation_data)
                    cleaned_confirmations.append(confirmation.get("quote", ""))
                except Exception as e:
                    print(f"⚠️  Failed to save confirmation: {str(e)}")
                    continue
        
        # Save alerts with validation
        for alert in result.get("alerts", []):
            if isinstance(alert, dict):
                try:
                    alert_data = {
                        "hypothesis_id": db_hypothesis.id,
                        "alert_type": alert.get("type", "recommendation")[:50],  # Enforce limit
                        "message": alert.get("message", "")[:1000],  # Enforce limit (adjust based on your schema)
                        "priority": alert.get("priority", "medium")
                    }
                    # Validate priority
                    if alert_data["priority"] not in ["high", "medium", "low"]:
                        alert_data["priority"] = "medium"
                    
                    AlertCRUD.create_alert(db, alert_data)
                except Exception as e:
                    print(f"⚠️  Failed to save alert: {str(e)}")
                    continue
        
        # Return response with both contradictions AND confirmations
        return {
            "status": "success",
            "method": "enhanced_adk_v1.0.0",
            "hypothesis_id": db_hypothesis.id,
            "processed_hypothesis": clean_title,
            "confidence_score": result.get("confidence_score", 0.5),
            "research": result.get("research_data", {}),
            "contradictions": cleaned_contradictions,  # ✅ Now includes clean quotes
            "confirmations": cleaned_confirmations,    # ✅ Added missing confirmations
            "synthesis": result.get("synthesis", ""),
            "alerts": result.get("alerts", []),
            "recommendations": result.get("recommendations", ""),
            "timestamp": datetime.utcnow().isoformat(),
            "processing_stats": result.get("processing_stats", {})  # ✅ Added processing stats
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ADK processing error: {str(e)}")
        import traceback
        traceback.print_exc()  # ✅ Better error debugging
        raise HTTPException(status_code=500, detail=f"ADK processing failed: {str(e)}")

@app.get("/dashboard")
async def get_dashboard_data_adk(db: Session = Depends(get_db)):
    """Get all hypothesis data for the dashboard - ADK version."""
    try:
        summaries = DashboardCRUD.get_all_hypotheses_summary(db)
        
        # Format for frontend (same as LangGraph version)
        formatted_summaries = []
        for summary in summaries:
            if summary:
                hypothesis = summary["hypothesis"]
                formatted_summary = {
                    "id": hypothesis.id,
                    "title": hypothesis.title,
                    "status": hypothesis.status.replace("_", " ").title(),
                    "contradictions": summary["contradictions_count"],
                    "confirmations": summary["confirmations_count"],
                    "confidence": int(hypothesis.confidence_score * 100),
                    "lastUpdated": hypothesis.updated_at.strftime("%d/%m/%Y %H:%M"),
                    "trendData": summary["trend_data"],
                    "contradictions_detail": [
                        {
                            "quote": c.quote,
                            "reason": c.reason,
                            "source": c.source,
                            "strength": c.strength
                        } for c in summary["contradictions_detail"]
                    ],
                    "confirmations_detail": [
                        {
                            "quote": c.quote,
                            "reason": c.reason,
                            "source": c.source,
                            "strength": c.strength
                        } for c in summary["confirmations_detail"]
                    ]
                }
                formatted_summaries.append(formatted_summary)
        
        return {"status": "success", "data": formatted_summaries}
        
    except Exception as e:
        print(f"❌ Dashboard error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Dashboard error: {str(e)}")

@app.get("/hypothesis/{hypothesis_id}")
async def get_hypothesis_detail_adk(hypothesis_id: int, db: Session = Depends(get_db)):
    """Get detailed hypothesis information - ADK version."""
    try:
        summary = DashboardCRUD.get_hypothesis_summary(db, hypothesis_id)
        if not summary:
            raise HTTPException(status_code=404, detail="Hypothesis not found")
        
        return {
            "status": "success",
            "data": summary
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting hypothesis {hypothesis_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/alerts")
async def get_alerts_adk(db: Session = Depends(get_db)):
    """Get all unread alerts - ADK version."""
    try:
        alerts = AlertCRUD.get_unread_alerts(db)
        return {
            "status": "success",
            "alerts": [
                {
                    "id": alert.id,
                    "type": alert.alert_type,
                    "message": alert.message,
                    "priority": alert.priority,
                    "created_at": alert.created_at.isoformat()
                } for alert in alerts
            ]
        }
    except Exception as e:
        print(f"❌ Error getting alerts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/alerts/{alert_id}/read")
async def mark_alert_read_adk(alert_id: int, db: Session = Depends(get_db)):
    """Mark an alert as read - ADK version."""
    try:
        alert = AlertCRUD.mark_alert_as_read(db, alert_id)
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        return {"status": "success", "message": "Alert marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error marking alert {alert_id} as read: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
        
@app.post("/chat")
async def chat_with_agent(request_data: dict):
    """Chat with the financial agent."""
    try:
        message = request_data.get("message")
        session_id = request_data.get("session_id")
        
        if not message:
            raise HTTPException(status_code=400, detail="Missing message")
            
        result = await orchestrator.chat(message, session_id)
        
        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error"))
            
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

CHART_ANALYSIS_PROMPT = """You are a professional quantitative analyst specializing in technical chart analysis. 
Analyze this financial chart image with precision and mathematical depth.

OUTPUT FORMAT — STRICT:
Plain text only. No markdown. No asterisks (*). No bullet dashes (-). No pound signs (#).
Use numbered sections. Use labeled fields like "Support:" or "RSI estimate:" inline.
Never write filler like "Great chart!" or "Let's see what we have here."
Never end with soft commentary.

REQUIRED SECTIONS — include ALL of these:

1. CHART TYPE AND TIMEFRAME
State what type of chart this is (candlestick/line/bar), the visible timeframe (intraday/daily/weekly), and approximate date range if visible.

2. PRICE ACTION SUMMARY
State the current visible price range: High: [X], Low: [X], Last visible close: [X].
Describe the overall trend direction clearly: Uptrend / Downtrend / Sideways consolidation.
Quantify: "Price has moved approximately [X]% over the visible period."

3. KEY PRICE LEVELS
Support: [level] — reason derived from chart (e.g., prior swing low, high-volume zone)
Resistance: [level] — reason
If multiple levels identified, list them as: S1: [X], S2: [X], R1: [X], R2: [X]

4. TECHNICAL INDICATORS (read from chart or estimate from price action)
Moving Averages: State any visible MAs, their approximate values, and whether price is above or below.
If no MAs visible, estimate: "No MA overlay visible; based on price action, estimated MA20 ≈ [X]"
Volume: State if volume is increasing/decreasing/diverging from price.
RSI estimate: If RSI panel visible, state value. If not: "RSI panel not visible; momentum appears [overbought/oversold/neutral] based on price action slope."
MACD or other indicators: state if visible.

5. PATTERN IDENTIFICATION
Name any classical patterns visible: Head and Shoulders, Double Top/Bottom, Cup and Handle, Flags, Wedges, Triangles, Engulfing candles, Doji, Hammer, etc.
For each: "Pattern: [name] | Breakout target: [price] | Pattern height: [X units] | Probability: [estimate]%"

6. SHORT-TERM PREDICTION (next 1-5 sessions based on visible timeframe)
State a directional bias: Bullish / Bearish / Neutral with a confidence level (e.g., 65% confidence bearish).
Entry zone: [price range]
Target 1: [price] ([X]% move)
Target 2: [price] ([X]% move)  
Stop loss: [price] — invalidation level
Risk/Reward ratio: [X:1]

7. RISK ASSESSMENT
Primary risk: [what would invalidate the analysis]
Volatility assessment: Low / Medium / High — based on candle body sizes relative to wicks.

Be precise. If the chart is unclear or low resolution, state what you can and cannot determine."""

@app.post("/analyze-chart")
async def analyze_chart(request_data: dict):
    """Analyze a financial chart image using Gemini Vision."""
    try:
        import base64

        image_data = request_data.get("image")
        mime_type = request_data.get("mime_type", "image/png")

        if not image_data:
            raise HTTPException(status_code=400, detail="Missing image data")

        # Strip data URI prefix if present
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        image_bytes = base64.b64decode(image_data)

        project_id = os.getenv("PROJECT_ID", "sdr-agent-486508")
        location = os.getenv("REGION", "us-central1")
        gemini_api_key = os.getenv("GEMINI_API_KEY", "")

        analysis_text = None

        # Path 1: Vertex AI (preferred — Cloud Run uses service account auth)
        try:
            import vertexai
            from vertexai.generative_models import GenerativeModel, Part
            vertexai.init(project=project_id, location=location)
            model = GenerativeModel("gemini-2.0-flash")
            image_part = Part.from_data(data=image_bytes, mime_type=mime_type)
            response = model.generate_content([CHART_ANALYSIS_PROMPT, image_part])
            analysis_text = response.text
            print(f"✅ Chart analysis via Vertex AI ({len(analysis_text)} chars)")
        except Exception as vertex_err:
            print(f"⚠️ Vertex AI path failed: {vertex_err}, trying google-generativeai...")

            # Path 2: google.generativeai with API key
            if not gemini_api_key:
                raise RuntimeError(f"Vertex AI failed and GEMINI_API_KEY not set. Vertex error: {vertex_err}")

            import google.generativeai as genai
            genai.configure(api_key=gemini_api_key)
            model = genai.GenerativeModel("gemini-2.0-flash")
            image_part = {"mime_type": mime_type, "data": image_bytes}
            response = model.generate_content([CHART_ANALYSIS_PROMPT, image_part])
            analysis_text = response.text
            print(f"✅ Chart analysis via Gemini API key ({len(analysis_text)} chars)")

        return {
            "status": "success",
            "analysis": analysis_text,
            "model": "gemini-2.0-flash-vision"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Chart analysis error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chart analysis failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8080)))

# ── Serve React frontend (must be LAST — catches all non-API routes) ──
# FRONTEND_BUILD already resolved near top of file
if os.path.isdir(FRONTEND_BUILD):
    # Serve static assets (JS, CSS, images)
    app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_BUILD, "static")), name="static")

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        """Catch-all: serve React index.html for all non-API paths (SPA routing)."""
        index = os.path.join(FRONTEND_BUILD, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        return {"message": "Frontend not built"}
else:
    print(f"[INFO] Frontend build not found at {FRONTEND_BUILD} — API-only mode")


