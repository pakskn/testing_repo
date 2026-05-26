import json
try:
    with open('api_response2.json', 'r') as f:
        data = json.load(f)
    print(f"Total channels from API: {data.get('total', 'unknown')}")
    print(f"Number of channels in array: {len(data.get('channels', []))}")
except Exception as e:
    print(f"Error: {e}")
