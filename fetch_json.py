import requests
import json
import sys

try:
    # Next.js app runs on port 3000 inside the 'niche_app' container.
    # The container is exposed to the host via docker-compose port mapping.
    # We will try to fetch the raw API response to see what it is outputting.
    res = requests.get('http://127.0.0.1:3000/api/channels?type=long_form&limit=50', timeout=10)
    data = res.json()
    with open("api_response.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print("Saved to api_response.json!")
except Exception as e:
    print(f"Host fetch failed: {e}")
    sys.exit(1)
