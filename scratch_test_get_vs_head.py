import urllib.request
import urllib.error

url = "https://yt3.googleusercontent.com/ytc/AIdro_kYjgfYRxINomGzi5RgYqsltzsx6DfQFB3GM1wH=s200-c-k-c0x00ffffff-no-rj?days_since_epoch=19792"

print("--- TESTING HEAD REQUEST ---")
try:
    req = urllib.request.Request(
        url, 
        method='HEAD',
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    with urllib.request.urlopen(req, timeout=5) as response:
        print(f"HEAD Status: {response.getcode()}")
        print(f"HEAD Headers: {dict(response.headers)}")
except urllib.error.HTTPError as e:
    print(f"HEAD HTTP Error: {e.code} - {e.reason}")
except Exception as e:
    print(f"HEAD Exception: {e}")

print("\n--- TESTING GET REQUEST ---")
try:
    req = urllib.request.Request(
        url, 
        method='GET',
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    with urllib.request.urlopen(req, timeout=5) as response:
        print(f"GET Status: {response.getcode()}")
        print(f"GET Headers: {dict(response.headers)}")
        # Check first 100 bytes of body
        body = response.read(100)
        print(f"GET Body (first 100 bytes): {body}")
except urllib.error.HTTPError as e:
    print(f"GET HTTP Error: {e.code} - {e.reason}")
except Exception as e:
    print(f"GET Exception: {e}")
