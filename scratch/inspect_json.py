import json
import os

JSON_PATH = r"d:\Waqasalee\Niche R Tool\long-form-channels-2026-05-25-by-nexlev.json"

if os.path.exists(JSON_PATH):
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"Total channels: {len(data)}")
    if data:
        # print keys of first channel
        first = data[0]
        print("First channel keys:")
        for k, v in first.items():
            if k != "topVideos":
                print(f"  {k}: {type(v)} = {v}")
            else:
                print(f"  {k}: {type(v)} (length: {len(v)})")
else:
    print("JSON file not found.")
