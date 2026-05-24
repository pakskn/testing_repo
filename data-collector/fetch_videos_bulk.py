"""
Bulk Video Fetcher — Top 10 videos per channel (popular + recent outliers)
Fetches top 5 most-viewed + top 5 most-recent outlier videos.
Skips channels that already have videos. Sets sortOrder=1 for channels with thumbnails.
"""
import sys, io, sqlite3, uuid, requests, isodate, time
from datetime import datetime, timezone
from api_key_manager import APIKeyManager, safe_api_call
from dotenv import load_dotenv

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
load_dotenv()

DB_PATH    = '../prisma/dev.db'
LIMIT      = 4_000   # max channels this run
TOP_N      = 10      # videos to store per channel (5 popular + 5 recent outliers)

def fmt_dur(iso_d):
    try:
        t = int(isodate.parse_duration(iso_d).total_seconds())
        m,s=divmod(t,60); h,m=divmod(m,60)
        return f'{h}:{m:02d}:{s:02d}' if h else f'{m}:{s:02d}'
    except: return '0:00'

def api_get(url, params, km, retries=3):
    """API call with retry on network errors"""
    for attempt in range(retries):
        try:
            result = safe_api_call(lambda key: requests.get(url, params={**params, 'key': key}, timeout=15).json(), km)
            return result
        except Exception as e:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"    ⚡ Network error, retry {attempt+1}/{retries} in {wait}s...")
                time.sleep(wait)
            else:
                return None
    return None

def main():
    km = APIKeyManager()
    km.print_status()

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")

    # Priority: high outlier score, 5K-500K subs, NO videos yet
    channels = conn.execute('''
        SELECT c.channelId, c.channelName, c.subscribers, c.outlierScore
        FROM "Channel" c
        WHERE c.isActive=1
          AND c.subscribers BETWEEN 5000 AND 500000
          AND NOT EXISTS (SELECT 1 FROM "Video" v WHERE v.channelId=c.channelId)
        ORDER BY c.outlierScore DESC, c.subscribers DESC
        LIMIT ?
    ''', (LIMIT,)).fetchall()

    print(f"\n  Channels to process: {len(channels):,}")
    print(f"  Estimated quota:     {len(channels)*2:,} units")
    print(f"  Starting...\n")

    saved = net_err = api_err = vid_count = 0
    start = datetime.now()

    for i, (ch_id, name, subs, outlier) in enumerate(channels):
        # Get uploads playlist
        r = api_get('https://www.googleapis.com/youtube/v3/channels',
            {'part': 'contentDetails', 'id': ch_id}, km)

        if r is None:
            net_err += 1
            if net_err > 10:
                print("  ❌ Too many network errors — stopping")
                break
            continue
        if not r.get('items'):
            api_err += 1; continue

        uploads_pl = r['items'][0].get('contentDetails',{}).get('relatedPlaylists',{}).get('uploads','')
        if not uploads_pl:
            api_err += 1; continue

        # Get playlist items (fetch 50 for better popular/recent selection)
        pl = api_get('https://www.googleapis.com/youtube/v3/playlistItems',
            {'part': 'snippet', 'playlistId': uploads_pl, 'maxResults': 50}, km)

        if pl is None:
            net_err += 1
            if net_err > 10: break
            continue
        if pl.get('error',{}).get('code') == 403:
            print("  ⚠️  Quota exceeded — stopping"); break

        items = pl.get('items', [])
        vids = [item['snippet']['resourceId']['videoId'] for item in items
                if item['snippet'].get('resourceId',{}).get('kind') == 'youtube#video']
        if not vids:
            api_err += 1; continue

        # Get video details (batch up to 50)
        vr = api_get('https://www.googleapis.com/youtube/v3/videos',
            {'part': 'snippet,statistics,contentDetails', 'id': ','.join(vids[:50])}, km)

        if not vr or vr.get('error'):
            api_err += 1; continue

        all_videos = vr.get('items', [])

        # Prefer long videos (>= 60s), fallback to all
        long_vids = [v for v in all_videos
                     if isodate.parse_duration(v.get('contentDetails',{}).get('duration','PT0S')).total_seconds() >= 60]
        working = long_vids if long_vids else all_videos

        # ── Strategy: 4 popular + 3 recent + 3 random ──
        import random as _rand
        by_views = sorted(working, key=lambda v: int(v.get('statistics',{}).get('viewCount',0)), reverse=True)
        popular  = by_views[:4]
        used_ids = {v['id'] for v in popular}

        # 3 most recent not already in popular
        by_date = sorted(working, key=lambda v: v.get('snippet',{}).get('publishedAt',''), reverse=True)
        recent  = [v for v in by_date if v['id'] not in used_ids][:3]
        used_ids.update(v['id'] for v in recent)

        # 3 random from remaining
        remaining = [v for v in working if v['id'] not in used_ids]
        rand_vids = _rand.sample(remaining, min(3, len(remaining)))

        final = popular + recent + rand_vids  # up to 10 videos

        # Channel avg views for outlier flag
        ch_avg = conn.execute('SELECT avgViewsPerVideo FROM "Channel" WHERE channelId=?', (ch_id,)).fetchone()
        ch_avg_views = ch_avg[0] if ch_avg else 0

        conn.execute('DELETE FROM "Video" WHERE "channelId"=?', (ch_id,))
        for v in final:
            vs=v.get('statistics',{}); vsnip=v.get('snippet',{}); vd=v.get('contentDetails',{})
            pub_v = vsnip.get('publishedAt','')
            pub_dt = datetime.fromisoformat(pub_v.replace('Z','+00:00')) if pub_v else None
            v_views = int(vs.get('viewCount',0))
            # Mark as outlier if video views > 2× channel avg
            is_outlier = 1 if (ch_avg_views > 0 and v_views >= ch_avg_views * 2) else 0
            conn.execute('''INSERT OR IGNORE INTO "Video"
                ("id","videoId","channelId","title","thumbnailUrl","views","duration","publishedAt","isOutlier")
                VALUES(?,?,?,?,?,?,?,?,?)''',
                (str(uuid.uuid4()), v['id'], ch_id, vsnip.get('title',''),
                 vsnip.get('thumbnails',{}).get('medium',{}).get('url',''),
                 v_views, fmt_dur(vd.get('duration','PT0S')), pub_dt, is_outlier))
            vid_count += 1

        # Set sortOrder=1 for channels that have a thumbnail (thumbnail-first in UI)
        conn.execute('''
            UPDATE "Channel" SET sortOrder=1
            WHERE channelId=? AND thumbnailUrl IS NOT NULL AND thumbnailUrl != ''
        ''', (ch_id,))

        conn.commit()
        saved += 1
        net_err = 0  # Reset network error counter on success

        if saved % 200 == 0:
            elapsed = (datetime.now()-start).seconds
            icon = '🟢' if outlier >= 5 else '🟡' if outlier >= 2 else '🔴'
            print(f"  {icon} [{saved}/{len(channels)}] {name[:35]:35} | {subs:>7,} subs | {outlier:.1f}x | {vid_count} vids | {elapsed}s")

    total_ch = conn.execute('SELECT COUNT(DISTINCT channelId) FROM "Video"').fetchone()[0]
    total_v  = conn.execute('SELECT COUNT(*) FROM "Video"').fetchone()[0]
    conn.close()

    print("\n" + "=" * 65)
    print(f"  ✅ Done: {saved} channels, {vid_count} videos fetched")
    print(f"  Errors: {api_err} API | {net_err} network")
    print(f"  Total channels with videos: {total_ch:,}")
    print(f"  Total videos in DB: {total_v:,}")
    print("=" * 65)
    km.print_status()

if __name__ == "__main__":
    main()
