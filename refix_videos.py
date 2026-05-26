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

    print("--- RE-FETCHING VIDEOS USING UPLOADS PLAYLIST ---")
    cur.execute('SELECT "channelId", "channelName" FROM "Channel"')
    channels = cur.fetchall()
    
    for ch_id, name in channels:
        print(f"Fetching videos for: {name} ({ch_id})")
        
        # 1. Get uploads playlist ID
        ch_res = requests.get("https://www.googleapis.com/youtube/v3/channels", params={
            "part": "contentDetails", "id": ch_id, "key": API_KEY
        }).json()
        
        uploads_pl = ch_res.get("items", [{}])[0].get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
        if not uploads_pl:
            print(f"  -> No uploads playlist found for {name}.")
            continue

        # 2. Get up to 50 videos from uploads playlist
        pl_res = requests.get("https://www.googleapis.com/youtube/v3/playlistItems", params={
            "part": "snippet", "playlistId": uploads_pl, "maxResults": 50, "key": API_KEY
        }).json()
        
        items = pl_res.get("items", [])
        video_ids = [item["snippet"]["resourceId"]["videoId"] for item in items if item["snippet"].get("resourceId", {}).get("kind") == "youtube#video"]
        
        if not video_ids:
            print(f"  -> No videos found in uploads playlist for {name}.")
            continue

        # 3. Get detailed stats for these videos
        videos = []
        # Chunk requests into 50 (already max 50 here)
        v_res = requests.get("https://www.googleapis.com/youtube/v3/videos", params={
            "part": "snippet,statistics,contentDetails", "id": ",".join(video_ids), "key": API_KEY
        }).json()
        videos = v_res.get("items", [])
        
        # 4. Sort by viewCount descending and keep top 10
        videos.sort(key=lambda v: int(v.get("statistics", {}).get("viewCount", 0)), reverse=True)
        top_10 = videos[:10]
        
        # 5. Wipe old and save new
        cur.execute('DELETE FROM "Video" WHERE "channelId" = %s', (ch_id,))
        conn.commit()
        
        for v in top_10:
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
            
        print(f"  -> Saved {len(top_10)} most popular videos (out of {len(videos)} recent uploads checked).")

    cur.close()
    conn.close()
    print("All done!")

if __name__ == "__main__":
    main()
