import os
import psycopg2
from dotenv import load_dotenv

# We can import the functions from collector.py since they are in the same folder, 
# but collector.py is hardcoded with max_results=8. I will just rewrite the loop 
# and modify max_results. Actually, let's just make it self-contained.

import requests
from datetime import datetime, timezone
import isodate

load_dotenv()
API_KEY = os.getenv("YOUTUBE_API_KEY")
DB_URL  = os.getenv("DATABASE_URL")

def get_channel_info(channel_id):
    url = "https://www.googleapis.com/youtube/v3/channels"
    params = {
        "part": "snippet,statistics,contentDetails",
        "id": channel_id,
        "key": API_KEY
    }
    r = requests.get(url, params=params).json()
    if not r.get("items"):
        return None
    return r["items"][0]

def get_top_videos(channel_id, max_results=10, short_form=False, uploads_playlist_id=None):
    if not uploads_playlist_id:
        ch = get_channel_info(channel_id)
        if not ch: return []
        uploads_playlist_id = ch.get('contentDetails', {}).get('relatedPlaylists', {}).get('uploads', '')

    if not uploads_playlist_id: return []

    pl_params = {
        "part": "snippet",
        "playlistId": uploads_playlist_id,
        "maxResults": max_results * 2,
        "key": API_KEY,
    }
    pl_res = requests.get("https://www.googleapis.com/youtube/v3/playlistItems", params=pl_params).json()
    items = pl_res.get("items", [])
    if not items: return []

    video_ids = [item["snippet"]["resourceId"]["videoId"] for item in items if item["snippet"].get("resourceId", {}).get("kind") == "youtube#video"]
    if not video_ids: return []

    video_res = requests.get(
        "https://www.googleapis.com/youtube/v3/videos",
        params={
            "part": "snippet,statistics,contentDetails",
            "id": ",".join(video_ids[:min(len(video_ids), 50)]),
            "key": API_KEY,
        }
    ).json()
    videos = video_res.get("items", [])
    videos.sort(key=lambda v: int(v.get("statistics", {}).get("viewCount", 0)), reverse=True)
    return videos[:max_results]

def calculate_outlier_score(avg_views, subscribers):
    if subscribers == 0: return 0.0
    return round(avg_views / subscribers, 2)

def format_duration(iso_duration):
    try:
        duration = isodate.parse_duration(iso_duration)
        total_seconds = int(duration.total_seconds())
        minutes, seconds = divmod(total_seconds, 60)
        hours, minutes = divmod(minutes, 60)
        if hours > 0: return f"{hours}:{minutes:02d}:{seconds:02d}"
        return f"{minutes}:{seconds:02d}"
    except Exception: return "0:00"

def save_channel(conn, data):
    cur = conn.cursor()
    cur.execute("""
        UPDATE "Channel" SET
            "channelName"       = %(channelName)s,
            "channelHandle"     = %(channelHandle)s,
            "thumbnailUrl"      = %(thumbnailUrl)s,
            subscribers         = %(subscribers)s,
            "totalVideos"       = %(totalVideos)s,
            "totalViews"        = %(totalViews)s,
            "avgViewsPerVideo"  = %(avgViewsPerVideo)s,
            "outlierScore"      = %(outlierScore)s,
            "isMonetized"       = %(isMonetized)s,
            "updatedAt"         = NOW()
        WHERE "channelId" = %(channelId)s
    """, data)
    conn.commit()
    cur.close()

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

def process_existing_channel(conn, channel_id):
    print(f"Fetching API for: {channel_id}")
    info = get_channel_info(channel_id)
    if not info:
        print(f"  Not found: {channel_id}")
        return

    snippet     = info.get("snippet", {})
    stats       = info.get("statistics", {})
    name        = snippet.get("title", "")
    handle      = snippet.get("customUrl", "")
    thumbnail   = snippet.get("thumbnails", {}).get("default", {}).get("url", "")
    subscribers = int(stats.get("subscriberCount", 0))
    total_vids  = int(stats.get("videoCount", 0))
    total_views = int(stats.get("viewCount", 0))

    avg_views     = round(total_views / total_vids, 2) if total_vids > 0 else 0
    outlier_score = calculate_outlier_score(avg_views, subscribers)

    uploads_pl = info.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads", "")
    videos = get_top_videos(channel_id, max_results=10, uploads_playlist_id=uploads_pl)

    save_channel(conn, {
        "channelId":        channel_id,
        "channelName":      name,
        "channelHandle":    handle,
        "thumbnailUrl":     thumbnail,
        "subscribers":      subscribers,
        "totalVideos":      total_vids,
        "totalViews":       total_views,
        "avgViewsPerVideo": avg_views,
        "outlierScore":     outlier_score,
        "isMonetized":      subscribers >= 1000,
    })

    # Delete old videos for this channel
    cur = conn.cursor()
    cur.execute('DELETE FROM "Video" WHERE "channelId" = %s', (channel_id,))
    conn.commit()
    cur.close()

    for v in videos:
        v_stats   = v.get("statistics", {})
        v_snippet = v.get("snippet", {})
        v_details = v.get("contentDetails", {})
        pub_v     = v_snippet.get("publishedAt", "")
        pub_dt    = datetime.fromisoformat(pub_v.replace("Z", "+00:00")) if pub_v else None
        
        # Determine highest res thumbnail
        thumbnails = v_snippet.get("thumbnails", {})
        vid_thumb = thumbnails.get("maxres", {}).get("url") or thumbnails.get("high", {}).get("url") or thumbnails.get("medium", {}).get("url") or thumbnails.get("default", {}).get("url", "")
        
        save_video(conn, {
            "videoId":      v["id"],
            "channelId":    channel_id,
            "title":        v_snippet.get("title", ""),
            "thumbnailUrl": vid_thumb,
            "views":        int(v_stats.get("viewCount", 0)),
            "duration":     format_duration(v_details.get("duration", "PT0S")),
            "publishedAt":  pub_dt,
        })

    print(f"  Saved: {name} | {subscribers:,} subs | {len(videos)} videos")

def main():
    print("=" * 60)
    print("YouTube API Fetcher (Existing DB Channels)")
    print("=" * 60)

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute('SELECT "channelId" FROM "Channel"')
    rows = cur.fetchall()
    cur.close()

    channel_ids = [row[0] for row in rows]
    print(f"Found {len(channel_ids)} channels to process in DB\n")

    for ch_id in channel_ids:
        try:
            process_existing_channel(conn, ch_id)
        except Exception as e:
            print(f"  ERROR processing {ch_id}: {e}")

    conn.close()
    print("\nDone!")

if __name__ == "__main__":
    main()
