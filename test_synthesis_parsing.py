import asyncio
import os
import json
import sys
from dotenv import load_dotenv

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from app.adk.orchestrator import TradeSageOrchestrator

def test_parsing():
    print("--- Testing Synthesis Parsing Logic ---")
    
    orchestrator = TradeSageOrchestrator()
    
    # Mock response from synthesis agent
    mock_response = """
Executive Summary:
NVDA shows strong bullish momentum driven by AI chips and supply chain dominance.

Confirmations:
{
  "quote": "NVIDIA's Data Center revenue grew 427% YoY to $22.6B in Q1 2025.",
  "reason": "Explosive growth in data center segment validates the AI infrastructure thesis.",
  "source": "Q1 2025 Earnings Report",
  "strength": "Strong"
}
{
  "quote": "H100/H200 demand continues to outpace supply through late 2025.",
  "reason": "Persistent supply-demand imbalance ensures high margins and revenue visibility.",
  "source": "Supply Chain Analysis",
  "strength": "Strong"
}

confidence: 0.84

Recommendation: BULLISH
"""
    
    # Test _parse_synthesis_response
    contradictions = [] # Assume no contradictions for this test
    result = orchestrator._parse_synthesis_response(mock_response, contradictions)
    
    print("\n--- PARSING RESULTS ---")
    print(f"Confidence Score: {result.get('confidence_score')}")
    print(f"Number of Confirmations: {len(result.get('confirmations', []))}")
    
    for i, conf in enumerate(result.get('confirmations', []), 1):
        print(f"\nConfirmation {i}:")
        print(f"  Quote: {conf['quote']}")
        print(f"  Reason: {conf['reason']}")
        print(f"  Source: {conf['source']}")
        print(f"  Strength: {conf['strength']}")
    
    # Check assertions
    assert result['confidence_score'] == 0.84, f"Expected 0.84, got {result['confidence_score']}"
    assert len(result['confirmations']) == 2, f"Expected 2 confirmations, got {len(result['confirmations'])}"
    assert result['confirmations'][0]['strength'] == "Strong"
    
    print("\n✅ SUCCESS: Parsing logic correctly handled the new synthesis output format.")

if __name__ == "__main__":
    test_parsing()
