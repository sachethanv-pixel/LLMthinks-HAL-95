import yfinance as yf
try:
    print("Testing yfinance for AAPL...")
    ticker = yf.Ticker("AAPL")
    hist = ticker.history(period="1d")
    print(f"Current price: {hist['Close'].iloc[-1]}")
    
    print("Testing history for NVDA...")
    df = yf.download("NVDA", period="5d", progress=False)
    print(f"History data:\n{df.tail()}")
except Exception as e:
    print(f"Error: {e}")
