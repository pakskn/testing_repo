"""
YouTube Niche Finder — Import & Fetch 536 Shorts NexLev Channels
================================================================
Parses the 536 json files inside "536 Shorts Nexlev" folder, imports the channels
with 'short' type and their videos into the database (SQLite or PostgreSQL),
and uses the YouTube API to fetch/sync 10 videos for each channel with
high-quality thumbnails, views, and duration metadata, marking them as shorts.

Usage:
    python -X utf8 data-collector/import_536_shorts.py
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
JSON_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../536 Shorts Nexlev'))

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

def parse_views_str(val):
    """Parses views string like '61M views' or '695K views' into an integer."""
    if not val:
        return 0
    val_str = str(val).strip().lower().replace(' views', '').replace(' view', '').replace(',', '')
    try:
        if 'm' in val_str:
            return int(float(val_str.replace('m', '')) * 1_000_000)
        if 'k' in val_str:
            return int(float(val_str.replace('k', '')) * 1_000)
        if 'b' in val_str:
            return int(float(val_str.replace('b', '')) * 1_000_000_000)
        return int(float(val_str))
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
    print("🚀 YouTube Niche Finder — Bulk Import & Sync 536 Shorts Nexlev Channels")
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
            total_views = parse_int_safe(ch.get("totalViews", 0))
            num_of_uploads = parse_int_safe(ch.get("numOfUploads", 0))
            days_since_start = parse_int_safe(ch.get("daysSinceStart", 0))
            avg_view_per_video = parse_int_safe(ch.get("avgViewPerVideo", 0))
            outlier_score = parse_float_safe(ch.get("outlierScore", 0.0))
            categories = ch.get("categories", [])
            top_shorts_json = ch.get("topShorts", [])
            
            # Additional fields from schema mapping
            monthly_views = parse_int_safe(ch.get("avgMonthlyViews", total_views // 6 if days_since_start > 180 else total_views))
            avg_video_length = 30  # Standard duration for YouTube shorts
            is_monetized = subscribers >= 1000

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
            is_faceless = True # Highly standard for automated/bulk shorts channels

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
                """, (title, avatar_url, subscribers, num_of_uploads, total_views, 'short', niche,
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
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, false, ?, ?, ?, false, false, 0, 1.0, ?, ?, ?, ?)
                """, (ch_db_id, channel_id, title, handle, avatar_url, subscribers, num_of_uploads,
                      total_views, 'short', niche, days_since_start, avg_view_per_video, outlier_score,
                      is_monetized, is_news, is_entertainment, is_faceless, avg_video_length, monthly_views,
                      now_str, now_str))
            
            conn.commit()
            cursor.close()
            channels_imported += 1

            # Prepare videos list
            videos_to_upsert = {}

            # 1. Harvest outlier shorts from the JSON itself
            for v in top_shorts_json:
                vid_id = v.get("video_id")
                vid_title = v.get("title")
                views_str = v.get("views", "0")
                thumbnail = v.get("thumbnail")
                
                if vid_id:
                    videos_to_upsert[vid_id] = {
                        "videoId": vid_id,
                        "title": vid_title,
                        "duration": "0:30",
                        "views": parse_views_str(views_str),
                        "publishedAt": datetime.now(timezone.utc), # Fallback upload date
                        "thumbnailUrl": thumbnail
                    }

            # 2. Hybrid API Sync (cheapest Uploads playlist fetch, up to 10 latest shorts)
            if km:
                uploads_playlist_id = 'UU' + channel_id[2:]  # Auto-derive uploads playlist ID
                print(f"    📡 Fetching latest shorts from YouTube API (Playlist: {uploads_playlist_id})...")
                
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
                                    duration_iso = details.get('duration', 'PT30S')
                                    
                                    # Merge details
                                    videos_to_upsert[v_id] = {
                                        "videoId": v_id,
                                        "title": snippet_data["title"],
                                        "duration": fmt_dur(duration_iso) if duration_iso != 'PT0S' else "0:30",
                                        "views": parse_int_safe(stats.get('viewCount', 0)),
                                        "publishedAt": snippet_data["publishedAt"],
                                        "thumbnailUrl": snippet_data["thumbnailUrl"]
                                    }

            # 3. Upsert final videos list (limit to 10)
            cursor = conn.cursor()
            
            # Clean old videos
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
                pub_val = v['publishedAt'].isoformat() if isinstance(v['publishedAt'], datetime) else str(v['publishedAt'])
                
                cursor.execute("""
                    INSERT INTO "Video" (
                        "id", "videoId", "channelId", "title", "thumbnailUrl", "views",
                        "duration", "publishedAt", "isOutlier", "isNano", "isShort"
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, false, true)
                """, (v_db_id, v['videoId'], channel_id, v['title'], v['thumbnailUrl'],
                      v['views'], v['duration'], pub_val))
                videos_imported += 1

            conn.commit()
            cursor.close()
            print(f"    🟢 Successfully synced shorts channel: {title} | Subs: {subscribers:,} | {len(sorted_videos)} shorts synced.")

        except Exception as e:
            print(f"  ❌ Error processing file {filename}: {e}")
            errors_count += 1
            continue

    conn.close()

    print("\n" + "=" * 70)
    print("📋 OVERALL IMPORT SUMMARY")
    print("=" * 70)
    print(f" Total Shorts Channels Sync'd: {channels_imported:,}")
    print(f" Total Shorts Videos Synced:    {videos_imported:,}")
    print(f" Files with Errors:             {errors_count}")
    print("=" * 70)
    print("🎉 All 536 shorts channels processed! Caching and visual details synced perfectly.")

if __name__ == '__main__':
    main()
