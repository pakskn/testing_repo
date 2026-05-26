import requests
import json

try:
    res = requests.get('http://127.0.0.1:3000/api/channels?type=long_form&limit=50', timeout=10)
    data = res.json()
    for ch in data.get('channels', []):
        if ch['channelName'] == 'StrikeTheory':
            print("StrikeTheory API Videos:", json.dumps(ch['videos'], indent=2))
        if ch['channelName'] == 'Forgotten Factories Canada':
            print("FFC API Videos:", json.dumps(ch['videos'], indent=2))
except Exception as e:
    print(f"Error: {e}")
