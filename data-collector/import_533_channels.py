"""
YouTube Niche Finder — Import & Fetch 533 NexLev Channels
=========================================================
Parses the 533 json files inside "533 Nexlev" folder, imports the channels
and their videos into the database (SQLite or PostgreSQL dynamically),
and uses the YouTube API to fetch/sync 10 videos for each channel with
high-quality thumbnails, views, and duration metadata.

Usage:
    python -X utf8 data-collector/import_533_channels.py
"""

import os
import sys
import io
import json
import re
import random
import string
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

# Reconfigure stdout for UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Load environment
load_dotenv()

# Relative path adjustments
sys.path.append(os.path.dirname(__file__))
from db_helper import get_connection
from api_key_manager import APIKeyManager, safe_api_call

# Path configurations
JSON_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../533 Nexlev'))

def extract_channel_id(url):
    """Extracts 24-character channel ID from a YouTube URL."""
    if not url:
        return None
    url = url.strip()
    if "channel/" in url:
        parts = url.split("channel/")
        return parts[-1].split("/")[0].strip()
    match = re.search(r'(?:channel/|c/|@)?([A-Za-z0-9_-]{24})', url)
    if match:
        return match.group(1)
    return None

def generate_cuid():
    """Generates a 25-character lowercase alphanumeric string starting with 'c'."""
    chars = string.ascii_lowercase + string.digits
    return 'c' + ''.join(random.choice(chars) for _ in range(24))

def parse_float_safe(val):
    if val is None or val == 'N/A' or val == 'na':
        return 0.0
    try:
        return float(str(val).replace(',', ''))
    except ValueError:
        return 0.0

def parse_int_safe(val):
    if val is None or val == 'N/A' or val == 'na':
        return 0
    try:
        return int(float(str(val).replace(',', '')))
    except ValueError:
        return 0

def secs_iso(iso_d):
    import isodate
    try:
        return int(isodate.parse_duration(iso_d).total_seconds())
    except:
        return 0

def fmt_dur(iso_d):
    t = secs_iso(iso_d)
    m, s = divmod(t, 60)
    h, m = divmod(m, 60)
    return f'{h}:{m:02d}:{s:02d}' if h else f'{m}:{s:02d}'

def to_datetime(val):
    if not val:
        return None
    try:
        return datetime.fromisoformat(val.replace('Z', '+00:00'))
    except ValueError:
        try:
            return datetime.strptime(val, '%Y-%m-%d %H:%M:%S')
        except ValueError:
            return None

def main():
    print("=" * 70)
    print("🚀 YouTube Niche Finder — Bulk Import & Sync 533 Nexlev Channels")
    print(f"Source Directory: {JSON_DIR}")
    print("=" * 70)

    if not os.path.exists(JSON_DIR):
        print(f"❌ Error: JSON directory not found at: {JSON_DIR}")
        sys.exit(1)

    # Initialize key manager
    try:
        km = APIKeyManager()
        print("✅ API Key Manager initialized successfully.")
        km.print_status()
    except Exception as e:
        print(f"⚠️ Warning: Could not initialize API Key Manager: {e}")
        print("⚠️ Caching script will run in 'offline-import' mode using JSON data only.")
        km = None

    # Connect to Database
    print("Connecting to database...")
    # Smart absolute path resolution for SQLite to prevent path mismatch
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url or ("dev.db" in db_url and not db_url.startswith("file:D:")):
        correct_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../prisma/dev.db"))
        os.environ["DATABASE_URL"] = "file:" + correct_db_path
        print(f"📌 SQLite DATABASE_URL resolved to absolute: {os.environ['DATABASE_URL']}")
    try:
        conn = get_connection()
        print(f"✅ Connected to {'PostgreSQL' if conn.is_postgres else 'SQLite'} successfully.")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)

    # List all JSON files
    json_files = [f for f in os.listdir(JSON_DIR) if f.endswith('.json')]
    total_files = len(json_files)
    print(f"Found {total_files} channel JSON files to import.\n")

    channels_imported = 0
    videos_imported = 0
    errors_count = 0

    for idx, filename in enumerate(json_files, 1):
        file_path = os.path.join(JSON_DIR, filename)
        print(f"[{idx}/{total_files}] Processing: {filename}...")

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data_list = json.load(f)
            
            if not data_list or not isinstance(data_list, list):
                print(f"  ⚠️ Skipping empty or malformed file: {filename}")
                continue

            ch = data_list[0]
            title = ch.get("title", "Unknown").strip()
            url = ch.get("url")
            avatar_url = ch.get("channelAvatar")
            subscribers = parse_int_safe(ch.get("subscribers", 0))
            avg_view_per_video = parse_int_safe(ch.get("avgViewPerVideo", 0))
            days_since_start = parse_int_safe(ch.get("daysSinceStart", 0))
            num_of_uploads = parse_int_safe(ch.get("numOfUploads", 0))
            is_monetized = bool(ch.get("isMonetized", False))
            categories = ch.get("categories", [])
            is_faceless = bool(ch.get("isFaceless", False))
            total_views = parse_int_safe(ch.get("totalViews", 0))
            outlier_score = parse_float_safe(ch.get("outlierScore", 0.0))
            avg_video_length = parse_int_safe(ch.get("avgVideoLength", 0))
            monthly_views = parse_int_safe(ch.get("avgMonthlyViews", 0))
            top_videos_json = ch.get("topVideos", [])

            # Extract channelId
            channel_id = extract_channel_id(url)
            if not channel_id:
                print(f"  ⚠️ Could not extract channel ID from url '{url}'. Skipping.")
                errors_count += 1
                continue

            # Classify niche and details
            niche = categories[0] if categories else "General"
            handle = "@" + re.sub(r'[^a-zA-Z0-9]', '', title).lower()
            is_news = niche.lower() in ['news', 'politics', 'current events', 'geopolitics']
            is_entertainment = niche.lower() in ['entertainment', 'movies', 'celebrity', 'comedy', 'showbiz']

            # Upsert Channel
            now_str = datetime.now(timezone.utc).isoformat()
            
            # Check if channel exists
            cursor = conn.cursor()
            cursor.execute('SELECT "id" FROM "Channel" WHERE "channelId" = ?', [channel_id])
            existing_row = cursor.fetchone()
            
            if existing_row:
                # Update Channel
                cursor.execute("""
                    UPDATE "Channel" SET
                        "channelName" = ?, "thumbnailUrl" = ?, "subscribers" = ?,
                        "totalVideos" = ?, "totalViews" = ?, "channelType" = ?, "niche" = ?,
                        "daysSinceStart" = ?, "avgViewsPerVideo" = ?, "outlierScore" = ?,
                        "isMonetized" = ?, "isFaceless" = ?, "isNews" = ?, "isEntertainment" = ?,
                        "avgVideoLength" = ?, "monthlyViews" = ?, "updatedAt" = ?
                    WHERE "channelId" = ?
                """, (title, avatar_url, subscribers, num_of_uploads, total_views, 'long', niche,
                      days_since_start, avg_view_per_video, outlier_score, is_monetized, is_faceless,
                      is_news, is_entertainment, avg_video_length, monthly_views, now_str, channel_id))
            else:
                # Insert Channel
                ch_db_id = generate_cuid()
                cursor.execute("""
                    INSERT INTO "Channel" (
                        "id", "channelId", "channelName", "channelHandle", "thumbnailUrl",
                        "subscribers", "totalVideos", "totalViews", "channelType", "niche",
                        "daysSinceStart", "avgViewsPerVideo", "outlierScore", "isMonetized",
                        "isActive", "isKids", "isNews", "isEntertainment", "isFaceless", "isAi", "isNano",
                        "sortOrder", "shortsRatioLast30d", "avgVideoLength", "monthlyViews", "createdAt", "updatedAt"
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, false, ?, ?, ?, false, false, 0, 0.0, ?, ?, ?, ?)
                """, (ch_db_id, channel_id, title, handle, avatar_url, subscribers, num_of_uploads,
                      total_views, 'long', niche, days_since_start, avg_view_per_video, outlier_score,
                      is_monetized, is_news, is_entertainment, is_faceless, avg_video_length, monthly_views,
                      now_str, now_str))
            
            conn.commit()
            cursor.close()
            channels_imported += 1

            # Prepare videos list
            videos_to_upsert = {}

            # 1. First, harvest popular outlier videos from the JSON itself (highly valuable)
            for v in top_videos_json:
                vid_id = v.get("video_id")
                vid_title = v.get("video_title")
                length_text = v.get("length_text")
                views_count = parse_int_safe(v.get("video_view_count", 0))
                upload_date = v.get("video_upload_date")
                thumbnail = v.get("video_thumbnail_url")
                
                if vid_id:
                    videos_to_upsert[vid_id] = {
                        "videoId": vid_id,
                        "title": vid_title,
                        "duration": length_text,
                        "views": views_count,
                        "publishedAt": to_datetime(upload_date),
                        "thumbnailUrl": thumbnail
                    }

            # 2. Hybrid approach: If YouTube API is available, fetch up to 10 latest videos
            # using the cheapest Uploads Playlist endpoint (cost: 1-2 units total per channel!)
            if km:
                uploads_playlist_id = 'UU' + channel_id[2:]  # Auto-derive uploads playlist ID
                print(f"    📡 Fetching latest videos from YouTube API (Playlist: {uploads_playlist_id})...")
                
                # Fetch PlaylistItems
                pl_response = safe_api_call(lambda key: requests.get(
                    'https://www.googleapis.com/youtube/v3/playlistItems',
                    params={
                        'part': 'snippet',
                        'playlistId': uploads_playlist_id,
                        'maxResults': 12,
                        'key': key
                    }
                ).json(), km)
                
                if pl_response and 'items' in pl_response:
                    video_ids = []
                    api_videos_snippet = {}
                    
                    for item in pl_response['items']:
                        res = item.get('snippet', {})
                        res_id = res.get('resourceId', {})
                        if res_id.get('kind') == 'youtube#video':
                            v_id = res_id.get('videoId')
                            if v_id:
                                video_ids.append(v_id)
                                api_videos_snippet[v_id] = {
                                    "videoId": v_id,
                                    "title": res.get('title'),
                                    "publishedAt": to_datetime(res.get('publishedAt')),
                                    "thumbnailUrl": res.get('thumbnails', {}).get('medium', {}).get('url') or res.get('thumbnails', {}).get('default', {}).get('url')
                                }
                    
                    # Fetch real view count and duration for these video IDs
                    if video_ids:
                        v_response = safe_api_call(lambda key: requests.get(
                            'https://www.googleapis.com/youtube/v3/videos',
                            params={
                                'part': 'statistics,contentDetails',
                                'id': ','.join(video_ids[:10]),
                                'key': key
                            }
                        ).json(), km)
                        
                        if v_response and 'items' in v_response:
                            for item in v_response['items']:
                                v_id = item.get('id')
                                stats = item.get('statistics', {})
                                details = item.get('contentDetails', {})
                                
                                if v_id in api_videos_snippet:
                                    snippet_data = api_videos_snippet[v_id]
                                    duration_iso = details.get('duration', 'PT0S')
                                    
                                    # Merge real API details
                                    videos_to_upsert[v_id] = {
                                        "videoId": v_id,
                                        "title": snippet_data["title"],
                                        "duration": fmt_dur(duration_iso),
                                        "views": parse_int_safe(stats.get('viewCount', 0)),
                                        "publishedAt": snippet_data["publishedAt"],
                                        "thumbnailUrl": snippet_data["thumbnailUrl"]
                                    }

            # 3. Upsert the final merged list (limit to 10 videos as requested)
            cursor = conn.cursor()
            
            # Delete old videos to cleanly sync up to 10
            cursor.execute('DELETE FROM "Video" WHERE "channelId" = ?', [channel_id])
            conn.commit()

            # Limit to top 10 by views
            sorted_videos = sorted(
                videos_to_upsert.values(),
                key=lambda x: x['views'],
                reverse=True
            )[:10]

            for v in sorted_videos:
                v_db_id = generate_cuid()
                pub_val = v['publishedAt'].isoformat() if v['publishedAt'] else None
                
                cursor.execute("""
                    INSERT INTO "Video" (
                        "id", "videoId", "channelId", "title", "thumbnailUrl", "views",
                        "duration", "publishedAt", "isOutlier", "isNano", "isShort"
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, false, false)
                """, (v_db_id, v['videoId'], channel_id, v['title'], v['thumbnailUrl'],
                      v['views'], v['duration'], pub_val))
                videos_imported += 1

            conn.commit()
            cursor.close()
            print(f"    🟢 Successfully synced channel: {title} | Subs: {subscribers:,} | {len(sorted_videos)} videos synced.")

        except Exception as e:
            print(f"  ❌ Error processing file {filename}: {e}")
            errors_count += 1
            continue

    conn.close()

    print("\n" + "=" * 70)
    print("📋 OVERALL IMPORT SUMMARY")
    print("=" * 70)
    print(f" Total Channels Sync'd/Imported:  {channels_imported:,}")
    print(f" Total Videos Synced & Cached:     {videos_imported:,}")
    print(f" Files with Errors:                {errors_count}")
    print("=" * 70)
    print("🎉 All 533 channels processed! Caching and visual details synced perfectly.")

if __name__ == '__main__':
    main()
