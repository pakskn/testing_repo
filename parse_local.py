import os
import json
import glob

def main():
    summary_file = r"d:\Waqasalee\Niche R Tool\322 NexLev\long-form-channels-2026-05-26-by-nexlev.json"
    summary_data = []
    if os.path.exists(summary_file):
        with open(summary_file, 'r', encoding='utf-8') as f:
            summary_data = json.load(f)
            
    stats_lookup = {}
    for ch in summary_data:
        subs_str = str(ch.get("Subscribers", "0")).replace(",", "").upper()
        subs = 0
        if "K" in subs_str: subs = int(float(subs_str.replace("K", "")) * 1000)
        elif "M" in subs_str: subs = int(float(subs_str.replace("M", "")) * 1000000)
        else:
            try: subs = int(subs_str)
            except: subs = 0
            
        outlier = str(ch.get("Outlier Score", "0x"))
        try: out_val = float(outlier.replace("x", ""))
        except: out_val = 0.0
        
        stats_lookup[ch.get("Channel Name")] = {
            "subs": subs,
            "outlier": out_val,
            "niche": ch.get("Niche", "Unknown")
        }
        
    files = glob.glob(r"d:\Waqasalee\Niche R Tool\322 NexLev\channel-*.json")
    print(f"Found {len(files)} channel files.")
    
    output_channels = []
    for fpath in files:
        with open(fpath, 'r', encoding='utf-8') as f:
            cdata = json.load(f)
        
        if not cdata: continue
        ch_json = cdata[0]
        
        name = ch_json.get("title", "").strip()
        url = ch_json.get("url", "")
        
        ch_id = None
        if "channel/UC" in url:
            ch_id = url.split("channel/")[1].split("/")[0].split("?")[0]
            
        if not ch_id:
            print(f"Skipping {name} - No channel ID found in url: {url}")
            continue
            
        stats = stats_lookup.get(name)
        if stats:
            subs = stats["subs"]
            outlier = stats["outlier"]
            niche = stats["niche"]
        else:
            try: subs = int(ch_json.get("subscribers", 0))
            except: subs = 0
            try: outlier = float(str(ch_json.get("outlierScore", 0)).replace("x", ""))
            except: outlier = 0.0
            niche = "Unknown"
            
        output_channels.append({
            "channelId": ch_id,
            "channelName": name,
            "subscribers": subs,
            "outlierScore": outlier,
            "niche": niche
        })
        
    with open(r"d:\Waqasalee\Niche R Tool\niche-finder\batch_322.json", "w", encoding="utf-8") as f:
        json.dump(output_channels, f, indent=2)
        
    print(f"Saved {len(output_channels)} channels to batch_322.json")
    
if __name__ == "__main__":
    main()
