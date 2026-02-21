import asyncio
import json
import uuid
import os
from dotenv import load_dotenv

# Load .env before importing orchestrator
load_dotenv()

from app.adk.orchestrator import orchestrator

async def test_chat_workflow():
    """Test the chat workflow with session persistence."""
    
    session_id = f"test_chat_{uuid.uuid4().hex[:8]}"
    print(f"\n{'='*60}")
    print(f"Testing Chat with session: {session_id}")
    print(f"{'='*60}")
    
    queries = [
        "Hello! Who are you and what can you do?",
        "What is the current price of NVDA?",
        "What was the first thing I asked you?"
    ]
    
    for query in queries:
        print(f"\nUser: {query}")
        try:
            result = await orchestrator.chat(query, session_id)
            
            if result.get("status") == "success":
                print(f"Agent: {result.get('response')}")
                if result.get("tool_results"):
                    print(f"[Tools used: {', '.join(result['tool_results'].keys())}]")
            else:
                print(f"❌ Error: {result.get('error')}")
                
        except Exception as e:
            print(f"❌ Chat failed: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_chat_workflow())
