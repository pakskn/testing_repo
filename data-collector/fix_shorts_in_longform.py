"""
YouTube Niche Finder — Dynamic Shorts & Long-Form Channel Refiner
==================================================================
Identifies channels incorrectly showing YouTube Shorts on the Long-Form page.
Automatically checks the YouTube API for each 'long' channel:
1. If the channel has actual long-form videos (duration > 60s), it replaces
   its synced videos with genuine long-form videos.
2. If the channel has NO or very few long-form videos, it shifts the channel's
   type to 'short' in the database (moving it to the Shorts page).

Flushes the Redis cache at the end.

Usage:
    python data-collector/fix_shorts_in_longform.py
"""

import os
import sys
import io
import time
import requests
import isodate
from datetime import datetime, timezone
from dotenv import load_dotenv

# Ensure stdout uses UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

load_dotenv()

# Relative path adjustments
sys.path.append(os.path.dirname(__file__))
from db_helper import get_connection
from api_key_manager import APIKeyManager, safe_api_call

def dur_secs(iso_d):
    try:
        return int(isodate.parse_duration(iso_d).total_seconds())
    except:
        return 0

def fmt_dur(iso_d):
    t = dur_secs(iso_d)
    m, s = divmod(t, 60)
    h, m = divmod(m, 60)
    return f'{h}:{m:02d}:{s:02d}' if h else f'{m}:{s:02d}'

def duration_to_seconds(dur_str):
    if not dur_str:
        return 0
    parts = dur_str.split(':')
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 1:
            return int(parts[0])
    except:
        return 0

def to_datetime(val):
    if not val:
        return None
    try:
        return datetime.fromisoformat(val.replace('Z', '+00:00'))
    except ValueError:
        return None

def flush_redis_cache():
    url = os.getenv("UPSTASH_REDIS_REST_URL")
    token = os.getenv("UPSTASH_REDIS_REST_TOKEN")
    if not url or not token:
        print("⚠️ Upstash Redis REST credentials not found in environment. Skipping cache flush.")
        return

    print("\n🧹 Flushing Upstash Redis cache...")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.post(f"{url}/flushall", headers=headers)
        if res.status_code == 200:
            print("✅ Upstash Redis cache successfully flushed!")
        else:
            print(f"⚠️ Cache flush returned status: {res.status_code} | {res.text}")
    except Exception as e:
        print(f"❌ Error flushing Redis cache: {e}")

def main():
    print("=" * 80)
    print("🚀 Dynamic Shorts & Long-Form Channel Refiner Script")
    print("=" * 80)

    # Initialize key manager
    try:
        km = APIKeyManager()
        print("✅ API Key Manager initialized successfully.")
        km.print_status()
    except Exception as e:
        print(f"❌ Error: YouTube API Key Manager could not be initialized: {e}")
        sys.exit(1)

    # Connect to Database
    print("\nConnecting to database...")
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url or ("dev.db" in db_url and not db_url.startswith("file:D:")):
        correct_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../prisma/dev.db"))
        os.environ["DATABASE_URL"] = "file:" + correct_db_path
        print(f"📌 SQLite DATABASE_URL resolved to absolute: {os.environ['DATABASE_URL']}")
    
    try:
        conn = get_connection()
        print(f"✅ Connected to {'PostgreSQL' if conn.is_postgres else 'SQLite'} database.")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)

    # 1. Query all channels where channelType = 'long'
    cursor = conn.cursor()
    cursor.execute('SELECT "channelId", "channelName" FROM "Channel" WHERE "channelType" = \'long\'')
    long_channels = cursor.fetchall()
    cursor.close()

    total_long = len(long_channels)
    print(f"\nFound {total_long:,} Long-Form channels to scan for Shorts contamination.")

    shifted_count = 0
    refreshed_count = 0
    clean_count = 0

    for idx, (ch_id, name) in enumerate(long_channels, 1):
        # Check current synced videos for this channel
        cursor = conn.cursor()
        cursor.execute('SELECT "videoId", "title", "duration" FROM "Video" WHERE "channelId" = ?', [ch_id])
        videos = cursor.fetchall()
        cursor.close()

        if not videos:
            continue

        # Count how many of the synced videos are Shorts (duration <= 60 seconds)
        shorts_count = sum(1 for v in videos if duration_to_seconds(v[2]) <= 60)
        
        # If less than half of the videos are Shorts, this channel is clean. Skip it!
        if shorts_count < len(videos) * 0.5:
            clean_count += 1
            continue

        # This channel has Shorts contamination! Let's fetch details to resolve it.
        print(f"\n[{idx}/{total_long}] 🔍 Checking channel '{name}' ({ch_id}) | Sync'd shorts: {shorts_count}/{len(videos)}")

        try:
            uploads_playlist_id = 'UU' + ch_id[2:]
            
            # Fetch up to 30 playlist items from uploads playlist
            pl_response = safe_api_call(lambda key: requests.get(
                'https://www.googleapis.com/youtube/v3/playlistItems',
                params={
                    'part': 'snippet',
                    'playlistId': uploads_playlist_id,
                    'maxResults': 30,
                    'key': key
                }
            ).json(), km)

            if not pl_response or 'items' not in pl_response:
                print(f"   ⚠️ No playlist items returned. Skipping.")
                continue

            video_ids = []
            api_videos_snippet = {}
            for item in pl_response['items']:
                res = item.get('snippet', {})
                res_id = res.get('resourceId', {})
                if res_id.get('kind') == 'youtube#video':
                    v_id = res_id.get('videoId')
                    if v_id:
                        video_ids.append(v_id)
                        thumbnails = res.get('thumbnails', {})
                        v_thumb = (thumbnails.get('maxres', {}).get('url') or 
                                   thumbnails.get('high', {}).get('url') or 
                                   thumbnails.get('medium', {}).get('url') or 
                                   thumbnails.get('default', {}).get('url', ''))
                        
                        api_videos_snippet[v_id] = {
                            "videoId": v_id,
                            "title": res.get('title'),
                            "publishedAt": to_datetime(res.get('publishedAt')),
                            "thumbnailUrl": v_thumb
                        }

            # Batch fetch duration & statistics for these videos
            long_vids = []
            short_vids = []

            if video_ids:
                v_response = safe_api_call(lambda key: requests.get(
                    'https://www.googleapis.com/youtube/v3/videos',
                    params={
                        'part': 'statistics,contentDetails',
                        'id': ','.join(video_ids[:30]),
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
                            seconds = dur_secs(duration_iso)
                            
                            v_obj = {
                                "videoId": v_id,
                                "title": snippet_data["title"],
                                "duration": fmt_dur(duration_iso),
                                "views": int(stats.get('viewCount', 0)),
                                "publishedAt": snippet_data["publishedAt"],
                                "thumbnailUrl": snippet_data["thumbnailUrl"]
                            }

                            if seconds > 60:
                                long_vids.append(v_obj)
                            else:
                                short_vids.append(v_obj)

            # Decision Matrix:
            # If we found at least 3 genuine long-form videos, keep it as 'long' and update with long videos
            if len(long_vids) >= 3:
                print(f"   🟢 Keeping as LONG-FORM | Found {len(long_vids)} long videos (replacing Shorts).")
                
                cursor = conn.cursor()
                cursor.execute('DELETE FROM "Video" WHERE "channelId" = ?', [ch_id])
                
                # Sort long videos by view count descending and limit to top 10
                sorted_long = sorted(long_vids, key=lambda x: x['views'], reverse=True)[:10]
                for v in sorted_long:
                    import uuid
                    v_db_id = 'c' + uuid.uuid4().hex[:24]
                    pub_val = v['publishedAt'].isoformat() if v['publishedAt'] else None
                    cursor.execute("""
                        INSERT INTO "Video" (
                            "id", "videoId", "channelId", "title", "thumbnailUrl", "views",
                            "duration", "publishedAt", "isOutlier", "isNano", "isShort"
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, false, false)
                    """, (v_db_id, v['videoId'], ch_id, v['title'], v['thumbnailUrl'],
                          v['views'], v['duration'], pub_val))
                
                conn.commit()
                cursor.close()
                refreshed_count += 1
            else:
                # This is a pure Shorts channel! Shift it to 'short'
                print(f"   🔄 Shifting channel to SHORTS category! Only found {len(long_vids)} long videos.")
                
                cursor = conn.cursor()
                # Update channel type to 'short'
                cursor.execute('UPDATE "Channel" SET "channelType" = \'short\', "updatedAt" = ? WHERE "channelId" = ?', 
                               [datetime.now(timezone.utc).isoformat(), ch_id])
                
                # Delete existing video links and insert new fresh Shorts
                cursor.execute('DELETE FROM "Video" WHERE "channelId" = ?', [ch_id])
                
                sorted_shorts = sorted(short_vids + long_vids, key=lambda x: x['views'], reverse=True)[:10]
                for v in sorted_shorts:
                    import uuid
                    v_db_id = 'c' + uuid.uuid4().hex[:24]
                    pub_val = v['publishedAt'].isoformat() if v['publishedAt'] else None
                    
                    # Mark correctly as Shorts
                    cursor.execute("""
                        INSERT INTO "Video" (
                            "id", "videoId", "channelId", "title", "thumbnailUrl", "views",
                            "duration", "publishedAt", "isOutlier", "isNano", "isShort"
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, false, true)
                    """, (v_db_id, v['videoId'], ch_id, v['title'], v['thumbnailUrl'],
                          v['views'], v['duration'], pub_val))
                
                conn.commit()
                cursor.close()
                shifted_count += 1

        except Exception as e:
            print(f"   ❌ Error processing channel {name}: {e}")

    conn.close()

    print("\n" + "=" * 80)
    print("📋 DYNAMIC SHORTS REFINEMENT SUMMARY")
    print("=" * 80)
    print(f" Total Long-Form Channels Scanned:  {total_long:,}")
    print(f" Clean Long-Form Channels:          {clean_count:,}")
    print(f" Refreshed with Long Videos:        {refreshed_count:,}")
    print(f" Shifted to Shorts Category Page:   {shifted_count:,}")
    print("=" * 80)

    # Flush Redis cache
    flush_redis_cache()

    print("\n🎉 Refinement complete! Stale Redis database caches flushed successfully.")

if __name__ == '__main__':
    main()
