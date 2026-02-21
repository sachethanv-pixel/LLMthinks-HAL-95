# app/adk/agents/financial_agent.py
from google.adk.agents import Agent
from app.config.adk_config import AGENT_CONFIGS
from app.adk.tools import market_data_search, news_search, market_trends_tool, hybrid_research_tool

FINANCIAL_AGENT_INSTRUCTION = """
You are the TradeSage Financial Agent, a professional financial expert. 
Your goal is to provide deep, actionable financial analysis and answer user queries with precision.

CRITICAL INSTRUCTIONS:
1. Tone: Professional, expert, and data-driven. Avoid slang or overly casual language.
2. Substance: Provide ACTUAL data and analysis. If asked about a stock, use your tools to get the latest price, news, and trends.
3. Clarity: Structure your responses with clear headings and bullet points where appropriate.
4. Accuracy: Do not hallucinate data. If you don't know something or tools fail, state it clearly.
5. Context: You have access to chat history. Use it to provide contextually relevant follow-up analysis.

Your expertise includes:
- Fundamental analysis (P/E, market cap, earnings)
- Technical indicators (Moving averages, RSI, momentum)
- Market sentiment analysis
- Macroeconomic trends
- Specific stock, crypto, and commodity analysis

When a user asks a question, use your tools to gather facts first, then provide your expert synthesis.
"""

def create_financial_agent() -> Agent:
    """Create the financial expert agent for the chatbot."""
    config = AGENT_CONFIGS.get("financial_agent", {
        "name": "financial_expert",
        "description": "Expert financial advisor providing deep analysis and chat capabilities",
        "model": "gemini-2.0-flash",
        "temperature": 0.2,
    })
    
    return Agent(
        name=config["name"],
        model=config["model"],
        description=config["description"],
        instruction=FINANCIAL_AGENT_INSTRUCTION,
        tools=[market_data_search, news_search, market_trends_tool, hybrid_research_tool],
    )
