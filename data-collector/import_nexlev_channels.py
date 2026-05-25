import json
import os
import sys
import re
import random
import string
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

# Load environment
load_dotenv()

JSON_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../long-form-channels-2026-05-25-by-nexlev.json'))
DATABASE_URL = os.getenv("DATABASE_URL")

# Check paths
if not os.path.exists(JSON_PATH):
    # Try alternate location
    alt = os.path.abspath(os.path.join(os.path.dirname(__file__), '../long-form-channels-2026-05-25-by-nexlev.json'))
    if os.path.exists(alt):
        JSON_PATH = alt
    else:
        print(f"❌ Error: JSON source file not found at {JSON_PATH}")
        sys.exit(1)

if not DATABASE_URL:
    print("❌ Error: DATABASE_URL is not configured in .env!")
    sys.exit(1)

print("=" * 60)
print("🚀 YouTube Niche Finder — NexLev Channel Import Utility")
print(f"Source JSON:  {JSON_PATH}")
print(f"Target DB:    {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'PostgreSQL'}")
print("=" * 60)

def extract_channel_id(url):
    """
    Extracts 24-character channel ID from a YouTube URL.
    Example: youtube.com/channel/UCef_tmOhz8Y0xQ0KnmfenZQ -> UCef_tmOhz8Y0xQ0KnmfenZQ
    """
    if not url:
        return None
    url = url.strip()
    if "channel/" in url:
        parts = url.split("channel/")
        return parts[-1].split("/")[0].strip()
    # Alternate formats just in case
    match = re.search(r'(?:channel/|c/|@)?([A-Za-z0-9_-]{24})', url)
    if match:
        return match.group(1)
    return None

def generate_cuid():
    """
    Generates a 25-character lowercase alphanumeric string starting with 'c'
    to stay fully compatible with Prisma's CUID primary keys.
    """
    chars = string.ascii_lowercase + string.digits
    return 'c' + ''.join(random.choice(chars) for _ in range(24))

def to_datetime(val):
    """
    Converts timestamp string to python datetime.
    """
    if not val:
        return None
    try:
        return datetime.fromisoformat(val.replace('Z', '+00:00'))
    except ValueError:
        try:
            return datetime.strptime(val, '%Y-%m-%d %H:%M:%S')
        except ValueError:
            return None

def parse_float_safe(val):
    if val is None or val == 'N/A' or val == 'na':
        return 0.0
    try:
        return float(val)
    except ValueError:
        return 0.0

def main():
    # Load JSON data
    print("Loading JSON channel data...")
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        channels_data = json.load(f)
    
    print(f"Loaded {len(channels_data)} channels from JSON file.")
    
    # Connect to PostgreSQL
    print("Connecting to PostgreSQL...")
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    channels_added = 0
    channels_updated = 0
    videos_added = 0
    videos_updated = 0
    errors_count = 0
    
    print("\nStarting import transaction...")
    try:
        for idx, item in enumerate(channels_data, 1):
            title = item.get("title")
            url = item.get("url")
            avatar_url = item.get("channelAvatar")
            subscribers = item.get("subscribers", 0)
            avg_view_per_video = item.get("avgViewPerVideo", 0)
            days_since_start = item.get("daysSinceStart", 0)
            num_of_uploads = item.get("numOfUploads", 0)
            is_monetized = bool(item.get("isMonetized", False))
            categories = item.get("categories", [])
            format_type = item.get("format", "")
            is_faceless = bool(item.get("isFaceless", False))
            total_views = item.get("totalViews", 0)
            outlier_score_val = item.get("outlierScore", 0.0)
            top_videos = item.get("topVideos", [])
            avg_video_length = int(item.get("avgVideoLength", 0))
            monthly_views = int(item.get("avgMonthlyViews", 0))
            
            # Extract channelId
            channel_id = extract_channel_id(url)
            if not channel_id:
                print(f"⚠️ Channel {idx} ('{title}'): Could not extract channel ID from URL '{url}'. Skipping.")
                errors_count += 1
                continue
            
            # Form niche & handle
            niche = categories[0] if categories else "General"
            handle = "@" + re.sub(r'[^a-zA-Z0-9]', '', title).lower()
            outlier_score = parse_float_safe(outlier_score_val)
            
            # News/Entertainment classifications
            is_news = niche.lower() in ['news', 'politics', 'current events']
            is_entertainment = niche.lower() in ['entertainment', 'movies', 'celebrity', 'comedy']
            
            # Check if channel already exists
            cursor.execute('SELECT "id" FROM "Channel" WHERE "channelId" = %s', [channel_id])
            ch_row = cursor.fetchone()
            
            if ch_row:
                # Update existing channel record
                cursor.execute('''
                    UPDATE "Channel" SET
                        "channelName" = %s,
                        "thumbnailUrl" = %s,
                        "subscribers" = %s,
                        "totalVideos" = %s,
                        "totalViews" = %s,
                        "channelType" = %s,
                        "niche" = %s,
                        "daysSinceStart" = %s,
                        "avgViewsPerVideo" = %s,
                        "outlierScore" = %s,
                        "isMonetized" = %s,
                        "isFaceless" = %s,
                        "isNews" = %s,
                        "isEntertainment" = %s,
                        "avgVideoLength" = %s,
                        "monthlyViews" = %s,
                        "updatedAt" = %s
                    WHERE "channelId" = %s
                ''', [
                    title, avatar_url, subscribers, num_of_uploads, total_views, 
                    'long', niche, days_since_start, avg_view_per_video, outlier_score,
                    is_monetized, is_faceless, is_news, is_entertainment, avg_video_length, monthly_views, datetime.now(), channel_id
                ])
                channels_updated += 1
                # print(f"   🔄 Updated channel: {title} ({channel_id})")
            else:
                # Insert new channel record
                ch_db_id = generate_cuid()
                cursor.execute('''
                    INSERT INTO "Channel" (
                        "id", "channelId", "channelName", "channelHandle", "thumbnailUrl",
                        "subscribers", "totalVideos", "totalViews", "channelType", "niche",
                        "daysSinceStart", "avgViewsPerVideo", "outlierScore", "isMonetized",
                        "isActive", "isKids", "isNews", "isEntertainment", "isFaceless", "isNano",
                        "sortOrder", "shortsRatioLast30d", "avgVideoLength", "monthlyViews", "createdAt", "updatedAt"
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', [
                    ch_db_id, channel_id, title, handle, avatar_url,
                    subscribers, num_of_uploads, total_views, 'long', niche,
                    days_since_start, avg_view_per_video, outlier_score, is_monetized,
                    True, False, is_news, is_entertainment, is_faceless, False,
                    0, 0.0, avg_video_length, monthly_views, datetime.now(), datetime.now()
                ])
                channels_added += 1
                # print(f"   ✅ Added channel: {title} ({channel_id})")
                
            # --- Handle top videos array ---
            for v in top_videos:
                video_id = v.get("video_id")
                video_title = v.get("video_title")
                length_text = v.get("length_text")
                video_view_count = v.get("video_view_count", 0)
                video_upload_date = v.get("video_upload_date")
                video_thumbnail_url = v.get("video_thumbnail_url")
                
                if not video_id:
                    continue
                
                try:
                    views = int(video_view_count)
                except:
                    views = 0
                    
                pub_at = to_datetime(video_upload_date)
                
                # Check if video exists
                cursor.execute('SELECT "id" FROM "Video" WHERE "videoId" = %s', [video_id])
                v_row = cursor.fetchone()
                
                if v_row:
                    # Update
                    cursor.execute('''
                        UPDATE "Video" SET
                            "channelId" = %s,
                            "title" = %s,
                            "thumbnailUrl" = %s,
                            "views" = %s,
                            "duration" = %s,
                            "publishedAt" = %s,
                            "isShort" = %s
                        WHERE "videoId" = %s
                    ''', [channel_id, video_title, video_thumbnail_url, views, length_text, pub_at, False, video_id])
                    videos_updated += 1
                else:
                    # Insert
                    v_db_id = generate_cuid()
                    cursor.execute('''
                        INSERT INTO "Video" (
                            "id", "videoId", "channelId", "title", "thumbnailUrl", "views", 
                            "duration", "publishedAt", "isOutlier", "isNano", "isShort"
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', [v_db_id, video_id, channel_id, video_title, video_thumbnail_url, views, length_text, pub_at, False, False, False])
                    videos_added += 1
        
        # Commit the transaction
        conn.commit()
        print("\n🎉 Import completed and committed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error during transaction execution. Rolled back changes. Error: {e}")
        errors_count += 1
    finally:
        cursor.close()
        conn.close()
        
    # --- Print Report ---
    print("\n" + "=" * 60)
    print("📋 IMPORT SUMMARY REPORT")
    print("=" * 60)
    print(f" Channels Added:     {channels_added:,}")
    print(f" Channels Updated:   {channels_updated:,}")
    print(f" Videos Added:       {videos_added:,}")
    print(f" Videos Updated:     {videos_updated:,}")
    print(f" Errors Encountered: {errors_count}")
    print("=" * 60)

if __name__ == '__main__':
    main()
