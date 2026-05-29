import os
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

def get_oldest_video_from_playlist(playlist_id, api_key):
    next_page_token = None
    last_items = []
    
    # Paginate to find the absolute oldest video (the last item of the playlist)
    # Limit to 10 pages to avoid quota depletion for massive channels
    for page in range(10):
        url = f"https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId={playlist_id}&maxResults=50&key={api_key}"
        if next_page_token:
            url += f"&pageToken={next_page_token}"
        try:
            res = requests.get(url).json()
            items = res.get("items", [])
            if not items:
                break
            last_items = items
            next_page_token = res.get("nextPageToken")
            if not next_page_token:
                break
        except Exception as e:
            print(f"Error fetching playlist items: {e}")
            break
            
    if last_items:
        oldest_item = last_items[-1]
        snippet = oldest_item["snippet"]
        return {
            "videoId": snippet["resourceId"]["videoId"],
            "title": snippet["title"],
            "publishedAt": snippet["publishedAt"],
            "thumbnailUrl": snippet["thumbnails"].get("high", {}).get("url") or snippet["thumbnails"].get("default", {}).get("url") or ""
        }
    return None

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
        
    oldest_vid = None
    if ch_details.get("uploadsPlaylistId"):
        oldest_vid = get_oldest_video_from_playlist(ch_details["uploadsPlaylistId"], API_KEY)
    
    # Calculate correct daysSinceStart based on publishedAt
    joined_date = datetime.datetime.fromisoformat(ch_details["publishedAt"].replace("Z", "+00:00"))
    now = datetime.datetime.now(datetime.timezone.utc)
    days_since = (now - joined_date).days
    
    print(f"Syncing {ch_details['channelName']}...")
    print(f" - Handle: {ch_details['channelHandle']}")
    print(f" - Joined Date: {joined_date.strftime('%Y-%m-%d')} ({days_since} days ago)")
    if oldest_vid:
        safe_title = oldest_vid['title'].encode('ascii', 'ignore').decode()
        print(f" - Oldest Video: {safe_title} ({oldest_vid['publishedAt']})")
        
    # Update in Database
    conn = None
    is_postgres = "postgres" in db_url or "postgresql" in db_url
    if is_postgres:
        import psycopg2
        conn = psycopg2.connect(db_url.split("?")[0])
    else:
        db_path = db_url.replace("file:", "").strip()
        conn = sqlite3.connect(db_path)
        
    cur = conn.cursor()
    
    # Fetch existing metrics to preserve them and calculate new fields
    if is_postgres:
        cur.execute('SELECT "shortsRatioLast30d", "avgViewsPerVideo", "monthlyViews", "country" FROM "Channel" WHERE "channelId" = %s', (channel_id,))
    else:
        cur.execute('SELECT shortsRatioLast30d, avgViewsPerVideo, monthlyViews, country FROM Channel WHERE channelId = ?', (channel_id,))
    row = cur.fetchone()
    
    existing_ratio = 50.0
    avg_views = 0.0
    monthly_views = 0
    existing_country = None
    if row:
        existing_ratio = row[0] if row[0] is not None and row[0] > 0 else 50.0
        avg_views = row[1] if row[1] is not None else 0.0
        monthly_views = int(row[2]) if row[2] is not None else 0
        existing_country = row[3]
        
    country = ch_details["country"] or existing_country or "N/A"
    
    # Calculate video counts
    shorts_count = int(round(ch_details["totalVideos"] * (existing_ratio / 100.0)))
    long_count = ch_details["totalVideos"] - shorts_count
    
    # Calculate updated monthlyViews
    monthly_views_est = int(round(avg_views * (ch_details["totalVideos"] / max(1, days_since / 30.0))))
    updated_monthly_views = max(monthly_views, monthly_views_est)
    if updated_monthly_views <= 0:
        updated_monthly_views = int(round(ch_details["totalViews"] / max(1, days_since / 30.0)))
        
    # 1. Update Channel table
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
                "monthlyViews" = %s,
                "updatedAt" = NOW()
            WHERE "channelId" = %s
        """, (ch_details["channelHandle"], ch_details["subscribers"], ch_details["totalVideos"], ch_details["totalViews"], days_since, country, long_count, shorts_count, updated_monthly_views, channel_id))
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
                monthlyViews = ?,
                updatedAt = datetime('now')
            WHERE channelId = ?
        """, (ch_details["channelHandle"], ch_details["subscribers"], ch_details["totalVideos"], ch_details["totalViews"], days_since, country, long_count, shorts_count, updated_monthly_views, channel_id))
        
    # 2. Insert oldest video if it exists so 1st upload date is correctly computed
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
                    VALUES (%s, %s, %s, %s, %s, 0, '10:00', %s, false)
                """, (cuid, oldest_vid["videoId"], channel_id, oldest_vid["title"], oldest_vid["thumbnailUrl"], oldest_vid["publishedAt"]))
            else:
                cur.execute("""
                    INSERT INTO Video (id, videoId, channelId, title, thumbnailUrl, views, duration, publishedAt, isShort)
                    VALUES (?, ?, ?, ?, ?, 0, '10:00', ?, 0)
                """, (cuid, oldest_vid["videoId"], channel_id, oldest_vid["title"], oldest_vid["thumbnailUrl"], oldest_vid["publishedAt"]))
                
    conn.commit()
    cur.close()
    conn.close()
    print("Sync completed successfully!\n")
    return True

if __name__ == '__main__':
    channel_to_sync = "UCC8EelolZsxysEZh4nuzk_Q" # Vintage Memories 66
    sync_channel(channel_to_sync)
