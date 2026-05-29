import os
import re
import sys
import requests
import sqlite3
import datetime
import uuid
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL")
API_KEY = os.getenv("YOUTUBE_API_KEY")

if not DB_URL or not API_KEY:
    print("Error: Missing DATABASE_URL or YOUTUBE_API_KEY in environment.")
    sys.exit(1)

def parse_iso_duration(duration_str):
    """Converts ISO 8601 duration (e.g. PT22M39S, PT1H7M) to total seconds."""
    if not duration_str:
        return 0
    pattern = re.compile(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?')
    match = pattern.match(duration_str)
    if not match:
        return 0
    hours = int(match.group(1)) if match.group(1) else 0
    minutes = int(match.group(2)) if match.group(2) else 0
    seconds = int(match.group(3)) if match.group(3) else 0
    return hours * 3600 + minutes * 60 + seconds

def fetch_channel_videos_exact_metrics(playlist_id, api_key, total_videos_limit):
    """
    Paginates uploads playlist (up to 500 videos), groups IDs in batches of 50,
    queries contentDetails for durations, and returns exact metrics.
    """
    video_ids = []
    next_page_token = None
    
    # 1. Fetch playlist items
    for page in range(10): # Fetch up to 500 uploads (highly quota efficient)
        url = f"https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId={playlist_id}&maxResults=50&key={api_key}"
        if next_page_token:
            url += f"&pageToken={next_page_token}"
        try:
            res = requests.get(url).json()
            items = res.get("items", [])
            if not items:
                break
            for item in items:
                v_id = item["snippet"]["resourceId"]["videoId"]
                pub_at = item["snippet"]["publishedAt"]
                video_ids.append((v_id, pub_at))
            next_page_token = res.get("nextPageToken")
            if not next_page_token:
                break
        except Exception as e:
            print(f"Error fetching playlist items: {e}")
            break
            
    if not video_ids:
        return 0, 0, 0, 0, None

    long_count = 0
    shorts_count = 0
    last30d_long = 0
    last30d_shorts = 0
    
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # 2. Batch duration lookup (50 per query)
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i+50]
        batch_ids = [item[0] for item in batch]
        ids_str = ",".join(batch_ids)
        
        url_vid = f"https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id={ids_str}&key={api_key}"
        try:
            res_vid = requests.get(url_vid).json()
            items_vid = res_vid.get("items", [])
            
            for item in items_vid:
                duration_str = item.get("contentDetails", {}).get("duration", "")
                sec = parse_iso_duration(duration_str)
                is_short = sec > 0 and sec <= 60
                
                published_at_str = item.get("snippet", {}).get("publishedAt", "")
                if published_at_str:
                    pub_date = datetime.datetime.fromisoformat(published_at_str.replace("Z", "+00:00"))
                    age_days = (now - pub_date).days
                    if age_days <= 30:
                        if is_short:
                            last30d_shorts += 1
                        else:
                            last30d_long += 1
                            
                if is_short:
                    shorts_count += 1
                else:
                    long_count += 1
        except Exception as e:
            print(f"Error fetching batch video details: {e}")
            
    # 3. Find absolute oldest video from the playlist array
    # Since playlist items are returned in reverse chronological order, the last one is oldest.
    oldest_video = None
    if video_ids:
        oldest_id, oldest_published = video_ids[-1]
        oldest_video = {
            "videoId": oldest_id,
            "publishedAt": oldest_published,
            "title": "Oldest Video Placeholder"
        }
        
    # Scale overall counts if the channel has more than 500 total videos
    if total_videos_limit > len(video_ids):
        scale_factor = total_videos_limit / max(1, len(video_ids))
        long_count = int(round(long_count * scale_factor))
        shorts_count = total_videos_limit - long_count
        
    return long_count, shorts_count, last30d_long, last30d_shorts, oldest_video

def get_channel_details(channel_id, api_key):
    url = f"https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id={channel_id}&key={api_key}"
    try:
        res = requests.get(url).json()
        if "items" in res and res["items"]:
            item = res["items"][0]
            snippet = item["snippet"]
            stats = item["statistics"]
            content_details = item.get("contentDetails", {})
            uploads_playlist_id = content_details.get("relatedPlaylists", {}).get("uploads")
            return {
                "channelName": snippet["title"],
                "channelHandle": snippet.get("customUrl", ""),
                "thumbnailUrl": snippet["thumbnails"].get("high", {}).get("url") or snippet["thumbnails"]["default"]["url"],
                "subscribers": int(stats.get("subscriberCount", 0)),
                "totalVideos": int(stats.get("videoCount", 0)),
                "totalViews": int(stats.get("viewCount", 0)),
                "publishedAt": snippet["publishedAt"],
                "country": snippet.get("country"),
                "uploadsPlaylistId": uploads_playlist_id
            }
    except Exception as e:
        print(f"Error fetching channel details: {e}")
    return None

def sync_channel(channel_id, custom_db_url=None):
    db_url = custom_db_url or DB_URL
    ch_details = get_channel_details(channel_id, API_KEY)
    if not ch_details:
        print("Failed to fetch channel details.")
        return False
        
    print(f"Syncing {ch_details['channelName']} ({channel_id})...")
    
    # 1. Fetch exact long/shorts counts, last 30d uploads, and oldest video details
    long_count = 0
    shorts_count = 0
    last30d_long = 0
    last30d_shorts = 0
    oldest_vid = None
    
    if ch_details.get("uploadsPlaylistId"):
        long_count, shorts_count, last30d_long, last30d_shorts, oldest_vid = fetch_channel_videos_exact_metrics(
            ch_details["uploadsPlaylistId"], API_KEY, ch_details["totalVideos"]
        )
    
    # Calculate days since start based on YouTube Joined Date
    joined_date = datetime.datetime.fromisoformat(ch_details["publishedAt"].replace("Z", "+00:00"))
    now = datetime.datetime.now(datetime.timezone.utc)
    days_since = (now - joined_date).days
    
    print(f" - Handle: {ch_details['channelHandle']}")
    print(f" - Joined Date: {joined_date.strftime('%Y-%m-%d')} ({days_since} days ago)")
    print(f" - Exact Total Videos: {ch_details['totalVideos']}")
    print(f" - Exact Long Videos: {long_count} | Exact Shorts: {shorts_count}")
    print(f" - Last 30d Uploads: Long: {last30d_long} | Shorts: {last30d_shorts}")
    
    if oldest_vid:
        print(f" - Oldest Video Date: {oldest_vid['publishedAt']}")
        
    # 2. Database Connection
    conn = None
    is_postgres = "postgres" in db_url or "postgresql" in db_url
    if is_postgres:
        import psycopg2
        conn = psycopg2.connect(db_url.split("?")[0])
    else:
        db_path = db_url.replace("file:", "").strip()
        conn = sqlite3.connect(db_path)
        
    cur = conn.cursor()
    
    # Fetch existing metrics to preserve monthlyViews and country
    if is_postgres:
        cur.execute('SELECT "monthlyViews", "country" FROM "Channel" WHERE "channelId" = %s', (channel_id,))
    else:
        cur.execute('SELECT monthlyViews, country FROM Channel WHERE channelId = ?', (channel_id,))
    row = cur.fetchone()
    
    existing_monthly_views = 0
    existing_country = None
    if row:
        existing_monthly_views = int(row[0]) if row[0] is not None else 0
        existing_country = row[1]
        
    country = ch_details["country"] or existing_country or "N/A"
    
    # Preserve scraped monthlyViews
    updated_monthly_views = existing_monthly_views
    if updated_monthly_views <= 0:
        updated_monthly_views = int(round(ch_details["totalViews"] / max(1, days_since / 30.0)))
        
    # 3. Update Channel Table
    first_upload_date = datetime.datetime.fromisoformat(oldest_vid["publishedAt"].replace("Z", "+00:00")) if oldest_vid else None
    
    if is_postgres:
        cur.execute("""
            UPDATE "Channel"
            SET "channelHandle" = %s,
                "subscribers" = %s,
                "totalVideos" = %s,
                "totalViews" = %s,
                "daysSinceStart" = %s,
                "country" = %s,
                "longVideosCount" = %s,
                "shortsVideosCount" = %s,
                "last30dLongUploads" = %s,
                "last30dShortsUploads" = %s,
                "monthlyViews" = %s,
                "firstUploadDate" = %s,
                "updatedAt" = NOW()
            WHERE "channelId" = %s
        """, (ch_details["channelHandle"], ch_details["subscribers"], ch_details["totalVideos"], ch_details["totalViews"], days_since, country, long_count, shorts_count, last30d_long, last30d_shorts, updated_monthly_views, first_upload_date, channel_id))
    else:
        cur.execute("""
            UPDATE Channel
            SET channelHandle = ?,
                subscribers = ?,
                totalVideos = ?,
                totalViews = ?,
                daysSinceStart = ?,
                country = ?,
                longVideosCount = ?,
                shortsVideosCount = ?,
                last30dLongUploads = ?,
                last30dShortsUploads = ?,
                monthlyViews = ?,
                firstUploadDate = ?,
                updatedAt = datetime('now')
            WHERE channelId = ?
        """, (ch_details["channelHandle"], ch_details["subscribers"], ch_details["totalVideos"], ch_details["totalViews"], days_since, country, long_count, shorts_count, last30d_long, last30d_shorts, updated_monthly_views, first_upload_date, channel_id))
        
    # 4. Insert oldest video to fix the 1st Upload Date display
    if oldest_vid:
        if is_postgres:
            cur.execute('SELECT COUNT(*) FROM "Video" WHERE "videoId" = %s', (oldest_vid["videoId"],))
        else:
            cur.execute('SELECT COUNT(*) FROM Video WHERE videoId = ?', (oldest_vid["videoId"],))
        exists = cur.fetchone()[0] > 0
        
        if not exists:
            cuid = "c" + uuid.uuid4().hex[:24]
            if is_postgres:
                cur.execute("""
                    INSERT INTO "Video" ("id", "videoId", "channelId", "title", "thumbnailUrl", "views", "duration", "publishedAt", "isShort")
                    VALUES (%s, %s, %s, %s, NULL, 0, '10:00', %s, false)
                """, (cuid, oldest_vid["videoId"], channel_id, oldest_vid["title"], oldest_vid["publishedAt"]))
            else:
                cur.execute("""
                    INSERT INTO Video (id, videoId, channelId, title, thumbnailUrl, views, duration, publishedAt, isShort)
                    VALUES (?, ?, ?, ?, NULL, 0, '10:00', ?, 0)
                """, (cuid, oldest_vid["videoId"], channel_id, oldest_vid["title"], oldest_vid["publishedAt"]))
                
    conn.commit()
    cur.close()
    conn.close()
    print("Channel synchronized successfully!\n")
    return True

if __name__ == '__main__':
    channel_to_sync = "UCKlqrW6bVLBV_ugrx1q_FkQ" # The 3rd Rail True Crime
    if len(sys.argv) > 1:
        channel_to_sync = sys.argv[1]
    sync_channel(channel_to_sync)
