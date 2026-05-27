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
        
    # include the original 13 files as well to fix 'Mintly Wise' etc.
    files_322 = glob.glob(r"d:\Waqasalee\Niche R Tool\322 NexLev\channel-*.json")
    files_13 = glob.glob(r"d:\Waqasalee\Niche R Tool\NexLev\channel-*.json")
    files = files_322 + files_13
    print(f"Found {len(files)} channel files.")
    
    output_channels = []
    seen = set()
    
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
            continue
            
        if ch_id in seen:
            continue
        seen.add(ch_id)
            
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
            
        avatar = ch_json.get("channelAvatar", "")
        handle = ""
        
        # Parse videos
        top_videos = ch_json.get("topVideos", [])
        videos_out = []
        for tv in top_videos:
            length_str = tv.get("length_text", "0:00")
            parts = length_str.split(":")
            try:
                if len(parts) == 3:
                    sec = int(parts[0])*3600 + int(parts[1])*60 + int(parts[2])
                elif len(parts) == 2:
                    sec = int(parts[0])*60 + int(parts[1])
                else:
                    sec = int(parts[0])
            except: sec = 0
            
            # EXPLICITLY filter out shorts (<= 60s)
            if sec > 60:
                vid = tv.get("video_id")
                videos_out.append({
                    "videoId": vid,
                    "title": tv.get("video_title", ""),
                    "thumbnailUrl": f"https://i.ytimg.com/vi/{vid}/maxresdefault.jpg",
                    "views": tv.get("video_view_count", 0),
                    "duration": length_str,
                    "publishedAt": tv.get("video_upload_date")
                })
                
        # Only keep top 10 long videos
        videos_out = videos_out[:10]
            
        output_channels.append({
            "channelId": ch_id,
            "channelName": name,
            "channelHandle": handle,
            "subscribers": subs,
            "outlierScore": outlier,
            "niche": niche,
            "avatar": avatar,
            "videos": videos_out
        })
        
    with open(r"d:\Waqasalee\Niche R Tool\niche-finder\batch_all.json", "w", encoding="utf-8") as f:
        json.dump(output_channels, f, indent=2)
        
    print(f"Saved {len(output_channels)} channels to batch_all.json")
    
if __name__ == "__main__":
    main()
