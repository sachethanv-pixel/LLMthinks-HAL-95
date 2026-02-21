import sys
import os
import uvicorn

# Add current directory to path
sys.path.append(os.getcwd())

if __name__ == "__main__":
    uvicorn.run("app.adk.main:app", host="0.0.0.0", port=8080, reload=True)
