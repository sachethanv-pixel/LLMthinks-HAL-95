import asyncio
import os
import json
import sys
from dotenv import load_dotenv

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from app.adk.orchestrator import TradeSageOrchestrator

async def test_synthesis():
    load_dotenv()
    print("--- Testing Synthesis Agent Update ---")
    
    orchestrator = TradeSageOrchestrator()
    
    # Sample hypothesis
    hypothesis = "NVDA will reach $150 by June 2026 due to AI supply chain dominance."
    
    print(f"\nProcessing Hypothesis: {hypothesis}")
    result = await orchestrator.process_hypothesis({"hypothesis": hypothesis})
    
    print("\n--- RESULTS ---")
    print(f"Status: {result.get('status')}")
    print(f"Confidence Score: {result.get('confidence_score')}")
    print(f"Number of Confirmations: {len(result.get('confirmations', []))}")
    
    confirmations = result.get('confirmations', [])
    if confirmations:
        print("\nSample Confirmation JSON:")
        print(json.dumps(confirmations[0], indent=2))
    
    print("\nSynthesis Summary:")
    print(result.get('synthesis')[:500] + "...")
    
    # Check if confidence score is in the strong range
    conf = result.get('confidence_score', 0)
    is_strong = (0.75 <= conf <= 0.85) or (0.15 <= conf <= 0.25)
    
    if is_strong:
        print("\n✅ SUCCESS: Confidence score is in the strong range.")
    else:
        print("\n❌ FAILURE: Confidence score is not in the strong range (Expected 0.15-0.25 or 0.75-0.85).")

if __name__ == "__main__":
    asyncio.run(test_synthesis())
