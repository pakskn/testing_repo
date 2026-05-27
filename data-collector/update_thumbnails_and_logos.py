"""
YouTube Niche Finder — Bulk Thumbnail & Logo Refresher (API-Powered)
=====================================================================
Fetches fresh, high-quality logos (avatars) and video thumbnails/metadata
from the YouTube API, rotating keys if quota is hit, and saves them in the DB.
Flushes Upstash Redis cache at the end to reflect changes instantly on the live site.

Usage:
    python data-collector/update_thumbnails_and_logos.py
"""

import os
import sys
import io
import time
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

# Ensure stdout uses UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

load_dotenv()

# Relative path adjustments
sys.path.append(os.path.dirname(__file__))
from db_helper import get_connection
from api_key_manager import APIKeyManager, safe_api_call

def fmt_dur(iso_d):
    import isodate
    try:
        t = int(isodate.parse_duration(iso_d).total_seconds())
        m, s = divmod(t, 60)
        h, m = divmod(m, 60)
        return f'{h}:{m:02d}:{s:02d}' if h else f'{m}:{s:02d}'
    except:
        return "0:00"

def to_datetime(val):
    if not val:
        return None
    try:
        return datetime.fromisoformat(val.replace('Z', '+00:00'))
    except ValueError:
        return None

def flush_redis_cache():
    """Flushes the Upstash Redis cache via REST API to ensure fresh DB data loads instantly."""
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
    print("🚀 YouTube Niche Finder — Bulk Thumbnail & Logo Refresher")
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

    # 1. Fetch all channels in DB
    cursor = conn.cursor()
    cursor.execute('SELECT "channelId", "channelName", "thumbnailUrl" FROM "Channel"')
    channels_in_db = cursor.fetchall()
    cursor.close()

    total_channels = len(channels_in_db)
    print(f"\nFound {total_channels:,} channels in the database.")

    # 2. Phase 1: Update Channel Logos (Avatars) in bulk (chunks of 50)
    print("\n🎨 Phase 1: Fetching fresh Logos (Avatars) from YouTube API...")
    channel_logos = {}
    
    for i in range(0, total_channels, 50):
        batch = channels_in_db[i:i+50]
        batch_ids = [ch[0] for ch in batch]
        
        print(f"   Fetching channel details [{i+1}-{min(i+50, total_channels)}/{total_channels}]...")
        
        try:
            r = safe_api_call(lambda key: requests.get(
                'https://www.googleapis.com/youtube/v3/channels',
                params={
                    'part': 'snippet,statistics',
                    'id': ','.join(batch_ids),
                    'maxResults': 50,
                    'key': key
                }
            ).json(), km)
            
            if r and 'items' in r:
                for item in r['items']:
                    ch_id = item['id']
                    snippet = item.get('snippet', {})
                    stats = item.get('statistics', {})
                    
                    # Try to get high quality avatar
                    thumbnails = snippet.get('thumbnails', {})
                    avatar = (thumbnails.get('high', {}).get('url') or 
                              thumbnails.get('medium', {}).get('url') or 
                              thumbnails.get('default', {}).get('url', ''))
                    
                    channel_logos[ch_id] = {
                        "avatar": avatar,
                        "title": snippet.get('title'),
                        "subscribers": int(stats.get('subscriberCount', 0)),
                        "totalViews": int(stats.get('viewCount', 0)),
                        "totalVideos": int(stats.get('videoCount', 0))
                    }
        except Exception as e:
            print(f"   ⚠️ Error fetching batch details: {e}")
            
    # Update Channel details in DB
    print("\n   Saving fresh avatars/details to database...")
    ch_updated = 0
    cursor = conn.cursor()
    
    for ch_id, details in channel_logos.items():
        try:
            cursor.execute("""
                UPDATE "Channel" SET
                    "thumbnailUrl" = ?,
                    "channelName" = ?,
                    "subscribers" = ?,
                    "totalViews" = ?,
                    "totalVideos" = ?,
                    "updatedAt" = ?
                WHERE "channelId" = ?
            """, (details["avatar"], details["title"], details["subscribers"],
                  details["totalViews"], details["totalVideos"],
                  datetime.now(timezone.utc).isoformat(), ch_id))
            ch_updated += 1
        except Exception as e:
            print(f"   ⚠️ Could not update channel {ch_id} in DB: {e}")
            
    conn.commit()
    cursor.close()
    print(f"✅ Successfully refreshed logos for {ch_updated:,} channels in DB.")

    # 3. Phase 2: Refresh Video thumbnails & views for each channel (cheapest Uploads playlist fetch)
    print("\n🎬 Phase 2: Syncing 10 latest videos per channel...")
    vids_updated = 0
    errors_count = 0

    for idx, (ch_id, old_name, old_avatar) in enumerate(channels_in_db, 1):
        name = channel_logos.get(ch_id, {}).get("title", old_name)
        print(f"[{idx}/{total_channels}] Syncing videos for: {name} ({ch_id})...")

        try:
            # Derive uploads playlist ID ( UU + channel_id[2:] )
            uploads_playlist_id = 'UU' + ch_id[2:]
            
            # Fetch PlaylistItems - 1 unit
            pl_response = safe_api_call(lambda key: requests.get(
                'https://www.googleapis.com/youtube/v3/playlistItems',
                params={
                    'part': 'snippet',
                    'playlistId': uploads_playlist_id,
                    'maxResults': 12,
                    'key': key
                }
            ).json(), km)
            
            if not pl_response or 'items' not in pl_response:
                print(f"   ⚠️ No videos found in uploads playlist for {name}.")
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
                        
                        # Determine high-res video thumbnail
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
            
            # Fetch real view count and duration in batch - 1 unit
            videos_to_upsert = {}
            if video_ids:
                v_response = safe_api_call(lambda key: requests.get(
                    'https://www.googleapis.com/youtube/v3/videos',
                    params={
                        'part': 'statistics,contentDetails',
                        'id': ','.join(video_ids[:10]),
                        'key': key
                    }
                ).json(), km)
                
                if v_response and 'items' in r := v_response:
                    for item in v_response['items']:
                        v_id = item.get('id')
                        stats = item.get('statistics', {})
                        details = item.get('contentDetails', {})
                        
                        if v_id in api_videos_snippet:
                            snippet_data = api_videos_snippet[v_id]
                            duration_iso = details.get('duration', 'PT0S')
                            
                            videos_to_upsert[v_id] = {
                                "videoId": v_id,
                                "title": snippet_data["title"],
                                "duration": fmt_dur(duration_iso),
                                "views": int(stats.get('viewCount', 0)),
                                "publishedAt": snippet_data["publishedAt"],
                                "thumbnailUrl": snippet_data["thumbnailUrl"]
                            }

            # Upsert into DB (clean deletion of old videos first to ensure up to 10 latest)
            if videos_to_upsert:
                cursor = conn.cursor()
                
                # Delete old videos to cleanly sync up to 10
                cursor.execute('DELETE FROM "Video" WHERE "channelId" = ?', [ch_id])
                
                # Insert top 10
                sorted_videos = sorted(
                    videos_to_upsert.values(),
                    key=lambda x: x['views'],
                    reverse=True
                )[:10]

                # Check if channel is short form
                cursor.execute('SELECT "channelType" FROM "Channel" WHERE "channelId" = ?', [ch_id])
                ch_row = cursor.fetchone()
                is_short = (ch_row[0] == 'short') if ch_row else False

                for v in sorted_videos:
                    import uuid
                    v_db_id = 'c' + uuid.uuid4().hex[:24]
                    pub_val = v['publishedAt'].isoformat() if v['publishedAt'] else None
                    
                    cursor.execute("""
                        INSERT INTO "Video" (
                            "id", "videoId", "channelId", "title", "thumbnailUrl", "views",
                            "duration", "publishedAt", "isOutlier", "isNano", "isShort"
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, false, ?)
                    """, (v_db_id, v['videoId'], ch_id, v['title'], v['thumbnailUrl'],
                          v['views'], v['duration'], pub_val, is_short))
                    vids_updated += 1
                
                conn.commit()
                cursor.close()
                print(f"   🟢 Synced {len(sorted_videos)} videos successfully.")
                
        except Exception as e:
            print(f"   ❌ Error syncing videos for channel {name}: {e}")
            errors_count += 1
            
    conn.close()
    
    print("\n" + "=" * 80)
    print("📋 REFRESH SUMMARY")
    print("=" * 80)
    print(f" Channels with Fresh Logos:   {ch_updated:,} / {total_channels:,}")
    print(f" Fresh Videos & Thumbnails:   {vids_updated:,}")
    print(f" Errors Encountered:          {errors_count}")
    print("=" * 80)
    
    # Flush cache to reflect instantly!
    flush_redis_cache()
    
    print("\n🎉 Refresh job complete! Live data cache cleared.")

if __name__ == '__main__':
    main()
