import requests

try:
    res = requests.get('http://10.0.3.3:3000/api/channels?type=long_form&limit=50', timeout=10)
    data = res.json()
    for ch in data.get('channels', []):
        if ch['channelName'] == 'StrikeTheory':
            print("StrikeTheory videos length:", len(ch.get('videos', [])))
            print(ch.get('videos'))
            break
except Exception as e:
    print(f"API Error: {e}")
