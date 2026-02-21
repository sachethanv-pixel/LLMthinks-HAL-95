# app/adk/tools.py - Fixed Tools (No Default Parameters)
from typing import Dict, Any, List
import json
import os
from app.services.market_data_service import get_market_data, market_data_service
from app.tools.news_data_tool import news_data_tool

def market_data_search(instrument: str) -> Dict[str, Any]:
    """Get market data and historical price trends for a financial instrument."""
    try:
        from app.services.market_data_service import get_market_data, market_data_service
        
        # Get current quote
        result = get_market_data(instrument)
        
        # Get history for trend charts (last 30 days)
        history = market_data_service.get_price_history(instrument, days=30)
        
        return {
            "status": "success",
            "data": result,
            "price_history": history,
            "instrument": instrument
        }
    except Exception as e:
        return {
            "status": "error", 
            "error": str(e),
            "instrument": instrument
        }

def news_search(query: str, days: int) -> Dict[str, Any]:  # REMOVED DEFAULT VALUE
    """Search for financial news."""
    try:
        # Dynamically get project ID from environment if possible
        project_id = os.getenv("PROJECT_ID", "sdr-agent-486508")
        result = news_data_tool(query, days, project_id)
        return {
            "status": "success",
            "data": result,
            "query": query
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e), 
            "query": query
        }

def market_trends_tool(instrument: str) -> Dict[str, Any]:
    """Get technical indicators and market trends for an instrument (Moving Averages, Momentum)."""
    try:
        result = market_data_service.get_market_trends(instrument)
        return {
            "status": "success",
            "data": result,
            "instrument": instrument
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "instrument": instrument
        }

def database_save(data_type: str, hypothesis_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    """Save data to the database."""
    try:
        from app.database.database import get_db
        from app.database.crud import ContradictionCRUD, ConfirmationCRUD
        
        db = next(get_db())
        
        if data_type == "contradiction":
            ContradictionCRUD.create_contradiction(db, {
                "hypothesis_id": hypothesis_id,
                **data
            })
        elif data_type == "confirmation": 
            ConfirmationCRUD.create_confirmation(db, {
                "hypothesis_id": hypothesis_id,
                **data
            })
        
        return {"status": "success", "message": f"Saved {data_type} to database"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

def sentiment_search_tool(query: str) -> Dict[str, Any]:
    """Search for retail sentiment on social platforms (Reddit, X/Twitter)."""
    try:
        # We simulate this by performing a news search with site operators
        # and looking for 'retail' / 'sentiment' keywords
        project_id = os.getenv("PROJECT_ID", "sdr-agent-486508")
        
        # Targeted social sentiment queries
        social_queries = [
            f"{query} reddit sentiment",
            f"{query} x twitter sentiment",
            f"{query} retail investor buzz"
        ]
        
        results = []
        for q in social_queries:
            res = news_data_tool(q, days=3, project_id=project_id)
            if res.get("status") == "success":
                results.extend(res.get("articles", []))
        
        return {
            "status": "success",
            "platform_buzz": results[:10],
            "query": query
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

def smart_money_tool(instrument: str) -> Dict[str, Any]:
    """Fetch institutional 'Smart Money' indicators (Ownership, Large Volume Flows)."""
    try:
        # Use FMP institutional data if available, or yfinance ownership
        from app.services.market_data_service import market_data_service
        
        # 1. Try to get institutional holders via yfinance
        import yfinance as yf
        ticker = yf.Ticker(instrument)
        holders = ticker.institutional_holders
        
        holdings_summary = []
        if holders is not None and not holders.empty:
            for _, row in holders.head(5).iterrows():
                holdings_summary.append({
                    "holder": str(row.get('Holder', 'Unknown')),
                    "shares": int(row.get('Shares', 0)),
                    "value": float(row.get('Value', 0))
                })
        
        # 2. Get volume trends (Institutional activity proxy)
        trends = market_data_service.get_market_trends(instrument)
        
        return {
            "status": "success",
            "institutional_holders": holdings_summary,
            "volume_analysis": trends.get("data", {}),
            "instrument": instrument,
            "smart_money_score": 0.7 if trends.get("trend") == "Bullish" else 0.4
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

def hybrid_research_tool(hypothesis: str, instruments: List[str]) -> Dict[str, Any]:
    """Perform hybrid research combining internal historical data (RAG) and real-time APIs."""
    try:
        from app.services.hybrid_rag_service import hybrid_research
        import asyncio
        
        # Run the async research method in a synchronous wrapper for tool compatibility
        # Note: In a production FastAPI environment, we should ideally use the async version
        # but ADK tools are typically sync wrappers.
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(hybrid_research(hypothesis, instruments))
        loop.close()
        
        return result
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "hypothesis": hypothesis
        }
