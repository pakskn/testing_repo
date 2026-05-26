import os
import json
import psycopg2
from dotenv import load_dotenv
import requests
import isodate

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

def fetch_top_long_videos_for_channel(channel_id, max_results=10):
    try:
        res = requests.get("https://www.googleapis.com/youtube/v3/search", params={
            "part": "snippet",
            "channelId": channel_id,
            "maxResults": 50,
            "order": "viewCount",
            "type": "video",
            "videoDuration": "medium", 
            "key": API_KEY
        }).json()
        
        if "items" not in res: return []
        
        video_ids = [item["id"]["videoId"] for item in res["items"] if "videoId" in item.get("id", {})]
        if not video_ids: return []
        
        v_res = requests.get("https://www.googleapis.com/youtube/v3/videos", params={
            "part": "snippet,statistics,contentDetails", "id": ",".join(video_ids), "key": API_KEY
        }).json()
        
        if "items" not in v_res: return []
        
        videos_to_save = []
        for v in v_res["items"]:
            iso_dur = v["contentDetails"].get("duration", "PT0S")
            seconds = get_duration_seconds(iso_dur)
            
            if seconds > 60:
                vid_thumb = v["snippet"]["thumbnails"].get("maxres", {}).get("url") or v["snippet"]["thumbnails"].get("high", {}).get("url") or ""
                videos_to_save.append({
                    "videoId": v["id"],
                    "title": v["snippet"].get("title", ""),
                    "thumbnailUrl": vid_thumb,
                    "views": int(v.get("statistics", {}).get("viewCount", 0)),
                    "duration": format_duration(iso_dur),
                    "publishedAt": v["snippet"].get("publishedAt")
                })
                
        videos_to_save.sort(key=lambda x: x["views"], reverse=True)
        return videos_to_save[:10]
    except Exception as e:
        print(f"Error fetching top long videos: {e}")
        return []

def save_channel(cur, ch):
    cur.execute('''
        INSERT INTO "Channel" ("channelId", "channelName", "channelHandle", "subscribers", "niche", "outlierScore", "channelType")
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT ("channelId") DO UPDATE SET
            "channelName" = EXCLUDED."channelName",
            "channelHandle" = EXCLUDED."channelHandle",
            "subscribers" = EXCLUDED."subscribers",
            "outlierScore" = EXCLUDED."outlierScore"
        RETURNING "channelId";
    ''', (
        ch["channelId"], ch["channelName"], ch.get("channelHandle", ""), 
        ch["subscribers"], ch["niche"], ch["outlierScore"], "long"
    ))
    return cur.fetchone()[0]

def save_video(cur, yt_ch_id, v):
    cur.execute('''
        INSERT INTO "Video" ("videoId", "channelId", "title", "thumbnailUrl", "views", "duration", "publishedAt", "isShort")
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT ("videoId") DO UPDATE SET
            "views" = EXCLUDED."views",
            "title" = EXCLUDED."title",
            "thumbnailUrl" = EXCLUDED."thumbnailUrl",
            "duration" = EXCLUDED."duration",
            "isShort" = EXCLUDED."isShort"
    ''', (
        v["videoId"], yt_ch_id, v["title"], v["thumbnailUrl"],
        v["views"], v["duration"], v["publishedAt"], False
    ))

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    print("Deleting 'DC Power Wars'...")
    cur.execute('''DELETE FROM "Video" WHERE "channelId" IN (SELECT "channelId" FROM "Channel" WHERE "channelName" = 'DC Power Wars');''')
    cur.execute('''DELETE FROM "Channel" WHERE "channelName" = 'DC Power Wars';''')
    conn.commit()
    
    print("Processing batch_all.json...")
    with open("batch_all.json", "r", encoding="utf-8") as f:
        channels = json.load(f)
        
    processed_channel_ids = set()
        
    for idx, ch in enumerate(channels):
        ch_id = ch["channelId"]
        processed_channel_ids.add(ch_id)
        print(f"[{idx+1}/{len(channels)}] Importing {ch['channelName']}...")
        
        yt_ch_id = save_channel(cur, ch)
        
        cur.execute('''DELETE FROM "Video" WHERE "channelId" = %s''', (yt_ch_id,))
        
        for v in ch["videos"]:
            save_video(cur, yt_ch_id, v)
            
        conn.commit()
        
    cur.execute('''SELECT "channelId", "channelName" FROM "Channel"''')
    db_channels = cur.fetchall()
    
    for yt_ch_id, c_name in db_channels:
        if yt_ch_id in processed_channel_ids:
            continue
            
        print(f"Fetching LONG videos via API for existing channel: {c_name}...")
        videos = fetch_top_long_videos_for_channel(yt_ch_id)
        if videos:
            cur.execute('''DELETE FROM "Video" WHERE "channelId" = %s''', (yt_ch_id,))
            for v in videos:
                save_video(cur, yt_ch_id, v)
            conn.commit()
        
    print("DONE!")
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
