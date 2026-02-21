from bs4 import BeautifulSoup
import json

def debug_parse():
    try:
        html = open('debug_yahoo.html', 'r', encoding='utf-8').read()
        soup = BeautifulSoup(html, 'html.parser')
        
        # 1. Price element
        print("--- fin-streamer regularMarketPrice elements ---")
        price_elements = soup.find_all('fin-streamer', {'data-field': 'regularMarketPrice'})
        for e in price_elements:
            print(f"Symbol: {e.get('data-symbol')}, Value: {e.get('value')}, Text: {e.get_text()}")
            
        print("\n--- data-test=qsp-price elements ---")
        qsp_elements = soup.find_all(attrs={"data-test": "qsp-price"})
        for e in qsp_elements:
            print(f"Text: {e.get_text()}")
            
        print("\n--- Price container with span ---")
        # many times it's h1's next sibling or similar
        headers = soup.find_all('h1')
        for h in headers:
            print(f"H1: {h.get_text()}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    debug_parse()
