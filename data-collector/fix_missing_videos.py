"""
Fix Missing Videos — Fetch videos for channels with < 3 videos
Uses API key rotation automatically
"""
import sys, io, sqlite3, uuid, requests, isodate
from datetime import datetime, timezone
from dotenv import load_dotenv
import os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
load_dotenv()

from api_key_manager import APIKeyManager, safe_api_call
km      = APIKeyManager()
DB_PATH = '../prisma/dev.db'

def get_channel_uploads_playlist(channel_id):
    result = safe_api_call(
        lambda key: requests.get("https://www.googleapis.com/youtube/v3/channels", params={
            "part": "contentDetails,snippet",
            "id": channel_id, "key": key,
        }).json(),
        km
    )
    if not result or not result.get('items'):
        return None, None
    item = result['items'][0]
    uploads = item.get('contentDetails', {}).get('relatedPlaylists', {}).get('uploads', '')
    thumb = item.get('snippet', {}).get('thumbnails', {}).get('default', {}).get('url', '')
    return uploads, thumb

def get_top_videos(uploads_pl, max_results=5):
    if not uploads_pl:
        return []
    pl = safe_api_call(
        lambda key: requests.get("https://www.googleapis.com/youtube/v3/playlistItems", params={
            "part": "snippet", "playlistId": uploads_pl,
            "maxResults": max_results * 3, "key": key,
        }).json(),
        km
    )
    if not pl: return []
    items = pl.get("items", [])
    if not items: return []
    vids = [i["snippet"]["resourceId"]["videoId"] for i in items
            if i["snippet"].get("resourceId", {}).get("kind") == "youtube#video"]
    if not vids: return []
    vr = safe_api_call(
        lambda key: requests.get("https://www.googleapis.com/youtube/v3/videos", params={
            "part": "snippet,statistics,contentDetails",
            "id": ",".join(vids[:50]), "key": key,
        }).json(),
        km
    )
    if not vr: return []
    videos = vr.get("items", [])
    videos.sort(key=lambda v: int(v.get("statistics", {}).get("viewCount", 0)), reverse=True)
    return videos[:max_results]

def format_duration(iso_d):
    try:
        t = int(isodate.parse_duration(iso_d).total_seconds())
        m, s = divmod(t, 60); h, m = divmod(m, 60)
        return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"
    except: return "0:00"

def save_video(conn, data):
    pub = data['publishedAt'].isoformat() if data['publishedAt'] else None
    conn.execute("""
        INSERT INTO "Video" ("id","videoId","channelId","title","thumbnailUrl","views","duration","publishedAt")
        VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT ("videoId") DO UPDATE SET
            "views"=excluded."views","title"=excluded."title",
            "thumbnailUrl"=excluded."thumbnailUrl"
    """, (str(uuid.uuid4()), data['videoId'], data['channelId'], data['title'],
          data['thumbnailUrl'], data['views'], data['duration'], pub))
    conn.commit()

def main():
    conn = sqlite3.connect(DB_PATH)

    # Get all channels with < 3 videos
    channels = conn.execute('''
        SELECT c.channelId, c.channelName, c.channelType, c.thumbnailUrl,
               COUNT(v.id) as vc
        FROM "Channel" c
        LEFT JOIN "Video" v ON v.channelId = c.channelId
        WHERE c.isActive = 1
        GROUP BY c.id
        HAVING vc < 3
        ORDER BY vc ASC, c.createdAt DESC
    ''').fetchall()

    print("=" * 65)
    print(f"  Fixing videos for {len(channels)} channels")
    km.print_status()
    print("=" * 65)

    fixed = failed = skipped = 0

    for ch_id, name, ch_type, thumb, existing_vids in channels:
        print(f"\n  → {name[:40]} ({existing_vids} videos)")

        # Get uploads playlist
        uploads_pl, api_thumb = get_channel_uploads_playlist(ch_id)

        if not uploads_pl:
            print(f"    ✗ Channel not found — skipping")
            failed += 1
            continue

        # Update thumbnail if missing
        if not thumb and api_thumb:
            conn.execute('UPDATE "Channel" SET "thumbnailUrl"=? WHERE "channelId"=?',
                        (api_thumb, ch_id))
            conn.commit()
            print(f"    ✓ Thumbnail updated")

        # Delete old videos and re-fetch
        conn.execute('DELETE FROM "Video" WHERE "channelId"=?', (ch_id,))
        conn.commit()

        videos = get_top_videos(uploads_pl, max_results=5)

        if not videos:
            print(f"    ✗ No videos found")
            failed += 1
            continue

        vid_count = 0
        for v in videos[:3]:
            vs = v.get('statistics', {}); vsnip = v.get('snippet', {})
            vd = v.get('contentDetails', {})
            pub_v = vsnip.get('publishedAt', '')
            pub_dt = datetime.fromisoformat(pub_v.replace('Z', '+00:00')) if pub_v else None
            save_video(conn, {
                'videoId': v['id'], 'channelId': ch_id,
                'title': vsnip.get('title', ''),
                'thumbnailUrl': vsnip.get('thumbnails', {}).get('medium', {}).get('url', ''),
                'views': int(vs.get('viewCount', 0)),
                'duration': format_duration(vd.get('duration', 'PT0S')),
                'publishedAt': pub_dt,
            })
            vid_count += 1

        print(f"    ✅ {vid_count} videos saved — {v['snippet'].get('title','')[:35] if videos else ''}")
        fixed += 1

    total_vids = conn.execute('SELECT COUNT(*) FROM "Video"').fetchone()[0]
    conn.close()

    print("\n" + "=" * 65)
    print(f"  Fixed: {fixed}  |  Failed: {failed}  |  Total videos in DB: {total_vids}")
    km.print_status()
    print("=" * 65)

if __name__ == "__main__":
    main()
