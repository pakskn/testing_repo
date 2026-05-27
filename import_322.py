import os
import json
import isodate
import psycopg2
from dotenv import load_dotenv
import requests

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
            
            # EXPLICITLY SKIP SHORTS
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
    
    with open("batch_322.json", "r", encoding="utf-8") as f:
        channels = json.load(f)
        
    print(f"Loaded {len(channels)} channels to process.")
    
    total_added = 0
    for idx, ch in enumerate(channels):
        ch_id = ch["channelId"]
        name = ch["channelName"]
        subs = ch["subscribers"]
        outlier = ch["outlierScore"]
        niche = ch["niche"]
        
        # Check if we already have 10 long videos for this channel?
        # To make it resumable, we check if it already exists with 10 videos
        cur.execute('''
            SELECT COUNT(*) FROM "Video"
            WHERE "channelId" = (SELECT "channelId" FROM "Channel" WHERE "channelId" = %s LIMIT 1)
        ''', (ch_id,))
        count_res = cur.fetchone()
        
        if count_res and count_res[0] >= 5:
            # We already processed this one, skip
            # Wait, no, let's just re-run anyway to be sure we get the newest or just overwrite
            # Since the user specifically wants to ensure ONLY LONG videos are fetched.
            # But the user might be referring to these NEW channels. We will process it.
            pass
            
        print(f"[{idx+1}/{len(channels)}] Processing {name} ({ch_id})...")
        
        logo, uploads_id, handle = fetch_channel_info(ch_id)
        if not uploads_id:
            print(f"  -> Failed to get uploads playlist. Skipping.")
            continue
            
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
        
        videos = fetch_only_long_videos(uploads_id, db_id)
        print(f"  -> Found {len(videos)} long videos.")
        for v in videos:
            save_video(cur, v)
        conn.commit()
        
        total_added += 1
        
    print(f"Successfully processed {total_added} channels.")
    cur.close()
    conn.close()
    
if __name__ == "__main__":
    main()
