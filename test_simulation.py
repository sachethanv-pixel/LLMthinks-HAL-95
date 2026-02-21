from dotenv import load_dotenv
import os
from app.services.market_data_service import market_data_service

def test_nvda_simulation():
    load_dotenv()
    print("--- Testing NVDA Simulation ---")
    
    # Test Alpha Vantage
    try:
        print("\nTesting Alpha Vantage Fetcher...")
        av_data = market_data_service._fetch_alpha_vantage("NVDA")
        print(f"AV Price: {av_data['data']['info']['currentPrice']} (Updated: {av_data['data']['info']['lastUpdated']})")
    except Exception as e:
        print(f"AV Failed: {e}")
        
    # Test FMP
    try:
        print("\nTesting FMP Fetcher...")
        fmp_data = market_data_service._fetch_fmp("NVDA")
        print(f"FMP Price: {fmp_data['data']['info']['currentPrice']} (Updated: {fmp_data['data']['info']['lastUpdated']})")
    except Exception as e:
        print(f"FMP Failed: {e}")
        
    # Test Yahoo Scraper
    try:
        print("\nTesting Yahoo Scraper...")
        yahoo_data = market_data_service._fetch_yahoo("NVDA")
        print(f"Yahoo Price: {yahoo_data['data']['info']['currentPrice']} (Updated: {yahoo_data['data']['info']['lastUpdated']})")
    except Exception as e:
        print(f"Yahoo Failed: {e}")

if __name__ == '__main__':
    test_nvda_simulation()
