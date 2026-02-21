# app/tools/news_data_tool.py
import requests
from google.cloud import secretmanager
import json
from datetime import datetime, timedelta

def get_secret(secret_name, project_id):
    """Retrieve secret from Secret Manager."""
    try:
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{project_id}/secrets/{secret_name}/versions/latest"
        response = client.access_secret_version(name=name)
        return response.payload.data.decode("UTF-8")
    except Exception as e:
        print(f"Error retrieving secret {secret_name}: {e}")
        return None

def news_data_tool(query, days=7, project_id="sdr-agent-486508"):
    """Tool for retrieving financial news with environment fallbacks."""
    try:
        import os
        # 1. Try environment variable first (preferred for local development)
        api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
        
        # 2. Fallback to Secret Manager if env is not set
        if not api_key:
            api_key = get_secret("alpha-vantage-key", project_id)
            
        if not api_key:
            return {"error": "Alpha Vantage API key not found in env or Secret Manager", "status": "error"}
            
        # Clean query for better results
        clean_query = query.replace("(", "").replace(")", "").split(" ")[0]
        url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers={clean_query}&apikey={api_key}"
        
        print(f"   📰 News API Query: {clean_query}")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        av_data = response.json()
        
        # Handle API error messages in JSON
        if "ErrorMessage" in av_data:
            return {"error": av_data["ErrorMessage"], "status": "error"}
        
        if "Note" in av_data and "rate limit" in av_data["Note"].lower():
            return {"error": "Alpha Vantage rate limit reached", "status": "error"}

        # Filter for recent news only
        cutoff_date = (datetime.now() - timedelta(days=days))
        
        if 'feed' in av_data:
            processed_news = []
            for article in av_data['feed'][:10]:  # Limit to 10 articles
                processed_news.append({
                    "title": article.get('title', ''),
                    "summary": article.get('summary', ''),
                    "source": article.get('source', ''),
                    "url": article.get('url', ''),
                    "published": article.get('time_published', ''),
                    "sentiment": article.get('overall_sentiment_score', 0)
                })
            
            return {
                "query": query,
                "days": days,
                "articles": processed_news,
                "status": "success"
            }
        
        # Fallback to FMP News if Alpha Vantage has no feed
        fmp_key = os.getenv("FMP_API_KEY")
        if fmp_key:
            print(f"   🔄 Falling back to FMP News for {clean_query}...")
            fmp_url = f"https://financialmodelingprep.com/api/v3/stock_news?tickers={clean_query}&limit=10&apikey={fmp_key}"
            fmp_response = requests.get(fmp_url, timeout=10)
            if fmp_response.ok:
                fmp_data = fmp_response.json()
                if isinstance(fmp_data, list) and len(fmp_data) > 0:
                    processed_news = []
                    for article in fmp_data:
                        processed_news.append({
                            "title": article.get('title', ''),
                            "summary": article.get('text', ''),
                            "source": article.get('site', ''),
                            "url": article.get('url', ''),
                            "published": article.get('publishedDate', ''),
                            "sentiment": 0  # FMP doesn't provide sentiment in this endpoint
                        })
                    return {
                        "query": query,
                        "articles": processed_news,
                        "status": "success",
                        "source": "FMP"
                    }

        return {"error": "No news data found in any source", "status": "error"}
        
    except Exception as e:
        return {
            "query": query,
            "error": str(e),
            "status": "error"
        }
