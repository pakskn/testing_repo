import os
import sys
import requests
import sqlite3
import datetime
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL")
API_KEY = os.getenv("YOUTUBE_API_KEY")

if not DB_URL or not API_KEY:
    print("Error: Missing DATABASE_URL or YOUTUBE_API_KEY.")
    sys.exit(1)

def get_db_connection(db_url):
    is_postgres = "postgres" in db_url or "postgresql" in db_url
    if is_postgres:
        import psycopg2
        return psycopg2.connect(db_url.split("?")[0]), True
    else:
        db_path = db_url.replace("file:", "").strip()
        return sqlite3.connect(db_path), False

def fetch_channels_batch(channel_ids, api_key):
    ids_str = ",".join(channel_ids)
    url = f"https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id={ids_str}&key={api_key}"
    try:
        res = requests.get(url).json()
        return res.get("items", [])
    except Exception as e:
        print(f"Error fetching batch: {e}")
        return []

def main():
    conn, is_postgres = get_db_connection(DB_URL)
    cur = conn.cursor()
    
    # 1. Fetch all channel IDs from database
    if is_postgres:
        cur.execute('SELECT "channelId" FROM "Channel";')
    else:
        cur.execute('SELECT channelId FROM Channel;')
        
    rows = cur.fetchall()
    channel_ids = [r[0] for r in rows]
    print(f"Found {len(channel_ids)} channels in database to sync.")
    
    # 2. Process in batches of 50
    batch_size = 50
    total_synced = 0
    
    for i in range(0, len(channel_ids), batch_size):
        batch = channel_ids[i:i+batch_size]
        print(f"Processing batch {i//batch_size + 1}/{((len(channel_ids)-1)//batch_size)+1} ({len(batch)} channels)...")
        
        items = fetch_channels_batch(batch, API_KEY)
        
        for item in items:
            cid = item["id"]
            snippet = item["snippet"]
            stats = item["statistics"]
            
            handle = snippet.get("customUrl", "")
            subs = int(stats.get("subscriberCount", 0))
            vids = int(stats.get("videoCount", 0))
            views = int(stats.get("viewCount", 0))
            published_at = snippet["publishedAt"]
            
            # Calculate correct daysSinceStart based on YouTube Joined Date
            joined_date = datetime.datetime.fromisoformat(published_at.replace("Z", "+00:00"))
            now = datetime.datetime.now(datetime.timezone.utc)
            days_since = (now - joined_date).days
            
            # Fetch existing metrics to preserve them and calculate new fields
            if is_postgres:
                cur.execute('SELECT "shortsRatioLast30d", "avgViewsPerVideo", "monthlyViews", "country" FROM "Channel" WHERE "channelId" = %s', (cid,))
            else:
                cur.execute('SELECT shortsRatioLast30d, avgViewsPerVideo, monthlyViews, country FROM Channel WHERE channelId = ?', (cid,))
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
                
            country = snippet.get("country") or existing_country or "N/A"
            
            # Calculate video counts
            shorts_count = int(round(vids * (existing_ratio / 100.0)))
            long_count = vids - shorts_count
            
            # Calculate updated monthlyViews
            monthly_views_est = int(round(avg_views * (vids / max(1, days_since / 30.0))))
            updated_monthly_views = max(monthly_views, monthly_views_est)
            if updated_monthly_views <= 0:
                updated_monthly_views = int(round(views / max(1, days_since / 30.0)))
            
            # Update database
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
                """, (handle, subs, vids, views, days_since, country, long_count, shorts_count, updated_monthly_views, cid))
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
                """, (handle, subs, vids, views, days_since, country, long_count, shorts_count, updated_monthly_views, cid))
                
            total_synced += 1
            
        conn.commit()
        
    cur.close()
    conn.close()
    print(f"Successfully synced {total_synced} channels!")

if __name__ == "__main__":
    main()
