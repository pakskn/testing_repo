import os
import psycopg2
import requests
from dotenv import load_dotenv
from datetime import datetime, timezone
import isodate

load_dotenv()
API_KEY = os.getenv("YOUTUBE_API_KEY")
DB_URL  = os.getenv("DATABASE_URL")

def format_duration(iso_duration):
    try:
        duration = isodate.parse_duration(iso_duration)
        total_seconds = int(duration.total_seconds())
        minutes, seconds = divmod(total_seconds, 60)
        hours, minutes = divmod(minutes, 60)
        if hours > 0: return f"{hours}:{minutes:02d}:{seconds:02d}"
        return f"{minutes}:{seconds:02d}"
    except Exception: return "0:00"

def save_video(conn, data):
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO "Video" (
            id, "videoId", "channelId", title,
            "thumbnailUrl", views, duration, "publishedAt"
        ) VALUES (
            gen_random_uuid(), %(videoId)s, %(channelId)s, %(title)s,
            %(thumbnailUrl)s, %(views)s, %(duration)s, %(publishedAt)s
        )
        ON CONFLICT ("videoId") DO UPDATE SET
            views    = EXCLUDED.views,
            title    = EXCLUDED.title,
            "thumbnailUrl" = EXCLUDED."thumbnailUrl"
    """, data)
    conn.commit()
    cur.close()

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    print("--- REMOVING DUPLICATE CHANNELS ---")
    # Keep the channel with the most videos/subs if there are duplicates by channelName
    cur.execute('''
        SELECT "channelName", array_agg(id) 
        FROM "Channel" 
        GROUP BY "channelName" 
        HAVING COUNT(*) > 1
    ''')
    duplicates = cur.fetchall()
    
    deleted_count = 0
    for name, ids in duplicates:
        # Keep the first ID, delete the rest
        keep_id = ids[0]
        delete_ids = ids[1:]
        print(f"Duplicate found: {name}. Keeping {keep_id}, deleting {delete_ids}")
        for d_id in delete_ids:
            cur.execute('DELETE FROM "Video" WHERE "channelId" = (SELECT "channelId" FROM "Channel" WHERE id = %s LIMIT 1)', (d_id,))
            cur.execute('DELETE FROM "Channel" WHERE id = %s', (d_id,))
            deleted_count += 1
    conn.commit()
    print(f"Deleted {deleted_count} duplicate channels.")

    print("\n--- FETCHING MOST POPULAR 10 VIDEOS FOR ALL CHANNELS ---")
    cur.execute('SELECT "channelId", "channelName" FROM "Channel"')
    channels = cur.fetchall()
    
    for ch_id, name in channels:
        print(f"Fetching most popular videos for: {name} ({ch_id})")
        
        # Use Search API to get exactly the most popular videos
        search_url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            "part": "snippet",
            "channelId": ch_id,
            "order": "viewCount",
            "maxResults": 10,
            "type": "video",
            "key": API_KEY
        }
        res = requests.get(search_url, params=params).json()
        items = res.get("items", [])
        
        if not items:
            print(f"  -> No videos found for {name}.")
            continue
            
        video_ids = [item["id"]["videoId"] for item in items if "videoId" in item.get("id", {})]
        
        if not video_ids:
            print(f"  -> No valid video IDs found for {name}.")
            continue

        # Get high-res thumbnails, durations, and accurate views from Videos API
        video_url = "https://www.googleapis.com/youtube/v3/videos"
        v_params = {
            "part": "snippet,statistics,contentDetails",
            "id": ",".join(video_ids),
            "key": API_KEY
        }
        v_res = requests.get(video_url, params=v_params).json()
        videos = v_res.get("items", [])
        
        # Wipe old videos just in case
        cur.execute('DELETE FROM "Video" WHERE "channelId" = %s', (ch_id,))
        conn.commit()
        
        for v in videos:
            v_stats   = v.get("statistics", {})
            v_snippet = v.get("snippet", {})
            v_details = v.get("contentDetails", {})
            pub_v     = v_snippet.get("publishedAt", "")
            pub_dt    = datetime.fromisoformat(pub_v.replace("Z", "+00:00")) if pub_v else None
            
            thumbnails = v_snippet.get("thumbnails", {})
            vid_thumb = thumbnails.get("maxres", {}).get("url") or thumbnails.get("high", {}).get("url") or thumbnails.get("medium", {}).get("url") or thumbnails.get("default", {}).get("url", "")
            
            save_video(conn, {
                "videoId":      v["id"],
                "channelId":    ch_id,
                "title":        v_snippet.get("title", ""),
                "thumbnailUrl": vid_thumb,
                "views":        int(v_stats.get("viewCount", 0)),
                "duration":     format_duration(v_details.get("duration", "PT0S")),
                "publishedAt":  pub_dt,
            })
            
        print(f"  -> Saved {len(videos)} most popular videos.")

    cur.close()
    conn.close()
    print("All done!")

if __name__ == "__main__":
    main()
