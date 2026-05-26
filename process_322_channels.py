import os
import json
import glob
import isodate
import psycopg2
from dotenv import load_dotenv
import requests
from urllib.parse import urlparse

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")
API_KEY = os.getenv("YOUTUBE_API_KEY")

def format_duration(iso_duration):
    try:
        duration = isodate.parse_duration(iso_duration)
        total_seconds = int(duration.total_seconds())
        minutes, seconds = divmod(total_seconds, 60)
        hours, minutes = divmod(minutes, 60)
        if hours > 0: return f"{hours}:{minutes:02d}:{seconds:02d}"
        return f"{minutes}:{seconds:02d}"
    except Exception: return "0:00"

def get_duration_seconds(iso_duration):
    try:
        duration = isodate.parse_duration(iso_duration)
        return int(duration.total_seconds())
    except Exception: return 0

def save_channel(cur, ch):
    cur.execute('''
        INSERT INTO "Channel" ("channelId", "channelName", "channelHandle", "subscribers", "niche", "outlierScore", "channelType", "uploadsPlaylistId")
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT ("channelId") DO UPDATE SET
            "channelName" = EXCLUDED."channelName",
            "channelHandle" = EXCLUDED."channelHandle",
            "subscribers" = EXCLUDED."subscribers",
            "outlierScore" = EXCLUDED."outlierScore",
            "uploadsPlaylistId" = EXCLUDED."uploadsPlaylistId"
        RETURNING id;
    ''', (
        ch["channelId"], ch["channelName"], ch["channelHandle"], 
        ch["subscribers"], ch["niche"], ch["outlierScore"], "long", ch["uploadsPlaylistId"]
    ))
    return cur.fetchone()[0]

def save_video(cur, v):
    cur.execute('''
        INSERT INTO "Video" ("videoId", "channelId", "title", "thumbnailUrl", "views", "duration", "publishedAt", "isShort")
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT ("videoId") DO UPDATE SET
            "views" = EXCLUDED."views",
            "title" = EXCLUDED."title",
            "thumbnailUrl" = EXCLUDED."thumbnailUrl"
    ''', (
        v["videoId"], v["channelId"], v["title"], v["thumbnailUrl"],
        v["views"], v["duration"], v["publishedAt"], False
    ))

def fetch_channel_info(channel_id):
    try:
        res = requests.get("https://www.googleapis.com/youtube/v3/channels", params={
            "part": "snippet,contentDetails", "id": channel_id, "key": API_KEY
        }).json()
        if "items" in res and res["items"]:
            item = res["items"][0]
            # Use maxres or high logo if possible, fallback to default
            logo = item["snippet"]["thumbnails"].get("high", {}).get("url") or item["snippet"]["thumbnails"]["default"]["url"]
            uploads_id = item["contentDetails"]["relatedPlaylists"]["uploads"]
            handle = item["snippet"].get("customUrl", "")
            return logo, uploads_id, handle
    except: pass
    return None, None, ""

def fetch_only_long_videos(uploads_playlist_id, db_channel_id):
    try:
        res = requests.get("https://www.googleapis.com/youtube/v3/playlistItems", params={
            "part": "snippet", "playlistId": uploads_playlist_id, "maxResults": 50, "key": API_KEY
        }).json()
        
        if "items" not in res: return []
        
        video_ids = [item["snippet"]["resourceId"]["videoId"] for item in res["items"]]
        if not video_ids: return []
        
        v_res = requests.get("https://www.googleapis.com/youtube/v3/videos", params={
            "part": "snippet,statistics,contentDetails", "id": ",".join(video_ids), "key": API_KEY
        }).json()
        
        if "items" not in v_res: return []
        
        videos_to_save = []
        for v in v_res["items"]:
            iso_dur = v["contentDetails"].get("duration", "PT0S")
            seconds = get_duration_seconds(iso_dur)
            
            # ONLY LONG VIDEOS
            if seconds > 60:
                vid_thumb = v["snippet"]["thumbnails"].get("maxres", {}).get("url") or v["snippet"]["thumbnails"].get("high", {}).get("url") or v["snippet"]["thumbnails"].get("medium", {}).get("url") or ""
                videos_to_save.append({
                    "videoId": v["id"],
                    "channelId": db_channel_id,
                    "title": v["snippet"].get("title", ""),
                    "thumbnailUrl": vid_thumb,
                    "views": int(v.get("statistics", {}).get("viewCount", 0)),
                    "duration": format_duration(iso_dur),
                    "publishedAt": v["snippet"].get("publishedAt")
                })
        
        videos_to_save.sort(key=lambda x: x["views"], reverse=True)
        return videos_to_save[:10]
    except Exception as e:
        print(f"Error fetching videos: {e}")
        return []

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
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
    
    total_added = 0
    for fpath in files:
        with open(fpath, 'r', encoding='utf-8') as f:
            cdata = json.load(f)
        
        if not cdata: continue
        ch_json = cdata[0]
        
        name = ch_json.get("title", "").strip()
        url = ch_json.get("url", "")
        
        # Extract channel ID from URL like youtube.com/channel/UC...
        ch_id = None
        if "channel/UC" in url:
            ch_id = url.split("channel/")[1].split("/")[0].split("?")[0]
            
        if not ch_id:
            print(f"Skipping {name} - No channel ID found in url: {url}")
            continue
            
        # Try to get stats from summary, fallback to JSON
        stats = stats_lookup.get(name)
        if stats:
            subs = stats["subs"]
            outlier = stats["outlier"]
            niche = stats["niche"]
        else:
            subs = int(ch_json.get("subscribers", 0))
            outlier = float(ch_json.get("outlierScore", 0))
            niche = "Unknown"
            
        print(f"Processing {name} ({ch_id})...")
        
        # 1. Fetch channel info from YT API
        logo, uploads_id, handle = fetch_channel_info(ch_id)
        if not uploads_id:
            print(f"  -> Failed to get uploads playlist. Skipping.")
            continue
            
        # 2. Save Channel
        ch_obj = {
            "channelId": ch_id,
            "channelName": name,
            "channelHandle": handle,
            "subscribers": subs,
            "niche": niche,
            "outlierScore": outlier,
            "uploadsPlaylistId": uploads_id
        }
        db_id = save_channel(cur, ch_obj)
        conn.commit()
        
        # 3. Fetch long videos
        videos = fetch_only_long_videos(uploads_id, db_id)
        print(f"  -> Found {len(videos)} long videos.")
        for v in videos:
            save_video(cur, v)
        conn.commit()
        
        total_added += 1
        
    print(f"Successfully processed {total_added} channels.")
    
if __name__ == "__main__":
    main()
