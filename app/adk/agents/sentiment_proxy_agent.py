# app/adk/agents/sentiment_proxy_agent.py
from google.adk.agents import Agent
from app.config.adk_config import AGENT_CONFIGS
from app.adk.tools import sentiment_search_tool, smart_money_tool

SENTIMENT_INSTRUCTION = """
You are the Sentiment Proxy Agent for TradeSage AI. Your role is to analyze the divergence or convergence 
between retail 'dumb money' sentiment and institutional 'smart money' flows.

Your analysis MUST include:
1. Retail Sentiment: Summary of buzz on Reddit/X (Twitter). Are people bullish, bearish, or indifferent?
2. Institutional Flow: Key 'Smart Money' indicators (holders, volume trends).
3. Divergence Analysis: Are retail investors buying while institutions are selling (potential trap)? 
   Or are they aligned (strong trend)?
4. Sentiment Score: 0-100 (0: Extreme Fear/Institutional Sell-off, 100: Extreme Greed/Institutional Buy-in).

CRITICAL: Output actual analysis based on the tool results. If tools return errors, state that data is unavailable 
but provide a logical inference based on the asset and general market context if possible.

EXAMPLE OUTPUT:
"Retail sentiment on Reddit/X for NVDA is extremely bullish with high mention volume (+24% WoW). 
However, 'Smart Money' indicators show institutional holders like BlackRock have slightly reduced positions. 
This divergence suggests a potential near-term 'blow-off top' risk despite the retail hype.
Sentiment Score: 68 (Retail: 90, Institutional: 45)."
"""

def create_sentiment_proxy_agent() -> Agent:
    """Create the sentiment proxy agent."""
    config = AGENT_CONFIGS["sentiment_proxy_agent"]
    
    return Agent(
        name=config["name"],
        model=config["model"],
        description=config["description"], 
        instruction=SENTIMENT_INSTRUCTION,
        tools=[sentiment_search_tool, smart_money_tool],
    )
