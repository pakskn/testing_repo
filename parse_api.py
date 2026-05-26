import json
with open('api_response.json', 'r') as f:
    data = json.load(f)
for ch in data.get('channels', []):
    if ch['channelName'] == 'StrikeTheory':
        print(f"StrikeTheory: {len(ch['videos'])} videos")
    if ch['channelName'] == 'NextMindset':
        print(f"NextMindset: {len(ch['videos'])} videos")
