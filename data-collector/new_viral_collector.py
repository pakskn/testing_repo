"""
New & Viral Channel Collector
================================
Dhundhta hai channels jo:
1. Last 30 din mein create hue hain  OR
2. Old channel lekin last 30 din mein videos upload karna shuru kiya
3. Outlier Score >= 3x (avg_views / subscribers)

Results ko descending outlier order mein show karta hai.
"""
import sys, io, sqlite3, uuid, requests, isodate
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
load_dotenv()

API_KEY = os.getenv('YOUTUBE_API_KEY')
DB_PATH  = '../next-app/prisma/dev.db'

# ── Thresholds ─────────────────────────────────────────────────────────────
MIN_SUBS    = 1_000      # Minimum subs
MAX_SUBS    = 500_000    # Maximum subs
MIN_OUTLIER = 2.0        # Minimum outlier score
DAYS_ACTIVE = 30         # Last upload within this many days
TARGET      = 20         # Kitne channels save karne hain

# ── Search Queries — new/viral niches ─────────────────────────────────────
SEARCH_QUERIES = [
    # HFy / Reddit Stories (viral niche)
    ("hfy reddit stories narrated new channel",           "HFy Stories"),
    ("reddit relationship story narrated channel",        "Reddit Stories"),
    ("aita reddit story narrated animated",               "Reddit Stories"),
    ("malicious compliance reddit narrated",              "Reddit Stories"),

    # Revenge / Drama (high retention niche)
    ("revenge story animated narrated 2025",              "Revenge Stories"),
    ("pro revenge satisfying story narrated",             "Revenge Stories"),
    ("entitled people story narrated channel",            "Revenge Stories"),

    # AI Restoration / Colorization (trending)
    ("ai colorization restored old video 2025",           "AI Restoration"),
    ("ai restored historical footage new channel",        "AI Restoration"),
    ("ai upscaling old photos restoration channel",       "AI Restoration"),

    # Horror / Scary Stories
    ("horror stories narrated animated new 2025",        "Horror"),
    ("scary paranormal stories narrated channel",        "Horror"),
    ("creepy true horror story narrated",                "Horror"),

    # Survival / Disaster
    ("survival story narrated animated channel",          "Survival"),
    ("disaster survival documentary narrated 2025",       "Survival"),

    # Conspiracy / Mystery
    ("conspiracy theory animated documentary new",        "Conspiracy"),
    ("unsolved mystery documentary narrated channel",     "Conspiracy"),

    # Motivational
    ("motivational animated speech new channel 2025",     "Motivation"),
    ("stoicism animated explained new channel",           "Self Improvement"),

    # Crime
    ("true crime documentary narrated new 2025",          "Crime"),
    ("criminal case documentary narrated channel",        "Crime"),

    # Health / Medical
    ("medical case animated explained channel",           "Health"),
    ("body health explained animated faceless",           "Health"),

    # AI Future
    ("ai future scenario animated documentary",           "AI"),
    ("artificial intelligence documentary animated 2025", "AI"),

    # Space
    ("space universe documentary animated 2025",          "Space"),
    ("black hole explained animated new channel",         "Space"),
]

# ─────────────────────────────────────────────────────────────────────────────
def search_channels(query, max_results=10):
    params = {
        "part": "snippet", "type": "channel",
        "q": query, "maxResults": max_results,
        "key": API_KEY,
    }
    r = requests.get("https://www.googleapis.com/youtube/v3/search", params=params).json()
    return [item['id']['channelId'] for item in r.get('items', [])]

def get_channel_full(channel_id):
    """Get channel info including uploads playlist ID."""
    params = {
        "part": "snippet,statistics,contentDetails",
        "id": channel_id, "key": API_KEY,
    }
    r = requests.get("https://www.googleapis.com/youtube/v3/channels", params=params).json()
    return r['items'][0] if r.get('items') else None

def get_latest_upload_date(uploads_playlist_id):
    """Get date of most recently uploaded video."""
    params = {
        "part": "snippet", "playlistId": uploads_playlist_id,
        "maxResults": 1, "key": API_KEY,
    }
    r = requests.get("https://www.googleapis.com/youtube/v3/playlistItems", params=params).json()
    items = r.get('items', [])
    if not items: return None
    pub = items[0]['snippet'].get('publishedAt', '')
    return datetime.fromisoformat(pub.replace('Z', '+00:00')) if pub else None

def get_top_videos(channel_id, max_results=5, uploads_playlist_id=None):
    """QUOTA-EFFICIENT: playlistItems.list = 1 unit (not search.list = 100 units)"""
    if not uploads_playlist_id:
        return []
    pl_res = requests.get("https://www.googleapis.com/youtube/v3/playlistItems", params={
        "part": "snippet", "playlistId": uploads_playlist_id,
        "maxResults": max_results * 3, "key": API_KEY,
    }).json()
    items = pl_res.get("items", [])
    if not items: return []
    vids = [item["snippet"]["resourceId"]["videoId"] for item in items
            if item["snippet"].get("resourceId", {}).get("kind") == "youtube#video"]
    if not vids: return []
    vr = requests.get("https://www.googleapis.com/youtube/v3/videos",
                      params={"part": "snippet,statistics,contentDetails",
                              "id": ",".join(vids[:50]), "key": API_KEY}).json()
    videos = vr.get("items", [])
    videos.sort(key=lambda v: int(v.get("statistics", {}).get("viewCount", 0)), reverse=True)
    return videos[:max_results]

def format_duration(iso_d):
    try:
        d = isodate.parse_duration(iso_d)
        t = int(d.total_seconds())
        m, s = divmod(t, 60)
        h, m = divmod(m, 60)
        return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"
    except: return "0:00"

def already_exists(conn, channel_id):
    return conn.execute('SELECT 1 FROM "Channel" WHERE "channelId"=?',
                        (channel_id,)).fetchone() is not None

def save_channel(conn, data):
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("""
        INSERT INTO "Channel" (
            "id","channelId","channelName","channelHandle","thumbnailUrl",
            "subscribers","totalVideos","totalViews","channelType","niche",
            "daysSinceStart","avgViewsPerVideo","outlierScore","isMonetized",
            "isActive","sortOrder","createdAt","updatedAt"
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0,?,?)
        ON CONFLICT ("channelId") DO UPDATE SET
            "channelName"=excluded."channelName",
            "thumbnailUrl"=excluded."thumbnailUrl",
            "subscribers"=excluded."subscribers",
            "totalVideos"=excluded."totalVideos",
            "totalViews"=excluded."totalViews",
            "avgViewsPerVideo"=excluded."avgViewsPerVideo",
            "outlierScore"=excluded."outlierScore",
            "isMonetized"=excluded."isMonetized",
            "updatedAt"=excluded."updatedAt"
    """, (str(uuid.uuid4()), data['channelId'], data['channelName'],
          data['channelHandle'], data['thumbnailUrl'], data['subscribers'],
          data['totalVideos'], data['totalViews'], data['channelType'],
          data['niche'], data['daysSinceStart'], data['avgViewsPerVideo'],
          data['outlierScore'], 1 if data['isMonetized'] else 0, now, now))
    conn.commit()

def save_video(conn, data):
    pub = data['publishedAt'].isoformat() if data['publishedAt'] else None
    conn.execute("""
        INSERT INTO "Video" ("id","videoId","channelId","title","thumbnailUrl",
                             "views","duration","publishedAt")
        VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT ("videoId") DO UPDATE SET
            "views"=excluded."views","title"=excluded."title",
            "thumbnailUrl"=excluded."thumbnailUrl"
    """, (str(uuid.uuid4()), data['videoId'], data['channelId'], data['title'],
          data['thumbnailUrl'], data['views'], data['duration'], pub))
    conn.commit()

# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("=" * 70)
    print("  New & Viral Channel Finder")
    print(f"  Filter: Last {DAYS_ACTIVE} days active | Outlier >= {MIN_OUTLIER}x")
    print(f"  Subs range: {MIN_SUBS:,} → {MAX_SUBS:,}")
    print("=" * 70)

    conn     = sqlite3.connect(DB_PATH)
    cutoff   = datetime.now(timezone.utc) - timedelta(days=DAYS_ACTIVE)
    seen_ids = set()
    results  = []   # Collect all qualifying channels, sort by outlier

    skip_subs_small = skip_subs_big = skip_dup = skip_old = skip_score = 0
    total_checked   = 0

    for query, niche in SEARCH_QUERIES:
        if len(results) >= TARGET * 3:   # Collect 3x target to sort
            break

        print(f"\n  🔍 {query[:55]}...")
        ch_ids = search_channels(query, max_results=10)

        for ch_id in ch_ids:
            if ch_id in seen_ids:
                continue
            seen_ids.add(ch_id)
            total_checked += 1

            if already_exists(conn, ch_id):
                skip_dup += 1
                continue

            info = get_channel_full(ch_id)
            if not info:
                continue

            sn   = info.get('snippet', {})
            st   = info.get('statistics', {})
            cd   = info.get('contentDetails', {})
            name = sn.get('title', '')
            subs = int(st.get('subscriberCount', 0))
            vids = int(st.get('videoCount', 0))
            views= int(st.get('viewCount', 0))

            # ── Subscriber filter ─────────────────────────────────────────
            if subs < MIN_SUBS:
                skip_subs_small += 1
                continue
            if subs > MAX_SUBS:
                skip_subs_big += 1
                continue

            # ── Channel creation date ─────────────────────────────────────
            pub_str = sn.get('publishedAt', '')
            if pub_str:
                ch_created = datetime.fromisoformat(pub_str.replace('Z', '+00:00'))
                days_since = (datetime.now(timezone.utc) - ch_created).days
                channel_new = ch_created >= cutoff
            else:
                days_since  = 0
                channel_new = False

            # ── Last upload date (via uploads playlist) ───────────────────
            uploads_pl = cd.get('relatedPlaylists', {}).get('uploads', '')
            last_upload = None
            if uploads_pl:
                last_upload = get_latest_upload_date(uploads_pl)

            recently_active = last_upload and last_upload >= cutoff

            # ── Must be new OR recently active ────────────────────────────
            if not channel_new and not recently_active:
                skip_old += 1
                continue

            # ── Outlier score ─────────────────────────────────────────────
            avg_views    = round(views / vids, 2) if vids > 0 else 0
            outlier      = round(avg_views / subs, 2) if subs > 0 else 0

            if outlier < MIN_OUTLIER:
                skip_score += 1
                print(f"    ⚡ {name[:35]:35} | {subs:>8,} subs | {outlier:.1f}x score (too low)")
                continue

            handle = sn.get('customUrl', '')
            thumb  = sn.get('thumbnails', {}).get('default', {}).get('url', '')

            # ── Activity label ────────────────────────────────────────────
            if channel_new:
                activity = f"NEW channel ({days_since}d old)"
            else:
                days_inactive = (datetime.now(timezone.utc) - last_upload).days if last_upload else 999
                activity = f"Active ({days_inactive}d ago)"

            uploads_pl = info.get('contentDetails', {}).get('relatedPlaylists', {}).get('uploads', '')
            results.append({
                'channelId': ch_id, 'channelName': name,
                'channelHandle': handle, 'thumbnailUrl': thumb,
                'subscribers': subs, 'totalVideos': vids, 'totalViews': views,
                'channelType': 'long_form', 'niche': niche,
                'daysSinceStart': days_since, 'avgViewsPerVideo': avg_views,
                'outlierScore': outlier,
                'isMonetized': subs >= 1000,
                'activity': activity,
                'lastUpload': last_upload,
                'uploads_pl': uploads_pl,
            })

            icon = '🟢' if outlier >= 10 else ('🟡' if outlier >= 5 else '🔵')
            print(f"    {icon} FOUND: {name[:35]:35} | {subs:>8,} subs | {outlier:.2f}x | {activity}")

    # ── Sort by outlier score (highest first) ─────────────────────────────
    results.sort(key=lambda x: x['outlierScore'], reverse=True)
    top = results[:TARGET]

    print("\n" + "=" * 70)
    print(f"  TOP {len(top)} RESULTS (sorted by Outlier Score)")
    print("=" * 70)

    saved = 0
    for i, ch in enumerate(top, 1):
        icon = '🟢' if ch['outlierScore'] >= 10 else ('🟡' if ch['outlierScore'] >= 5 else '🔵')
        print(f"\n  #{i:02d} {icon}  {ch['channelName']}")
        print(f"       Niche: {ch['niche']:<20}  Subs: {ch['subscribers']:>10,}")
        print(f"       Outlier: {ch['outlierScore']:.2f}x  AvgViews: {ch['avgViewsPerVideo']:,.0f}")
        print(f"       Status: {ch['activity']}")

        # ── Save to database ──────────────────────────────────────────────
        save_channel(conn, ch)

        # ── Get + save top 3 videos ───────────────────────────────────────
        conn.execute('DELETE FROM "Video" WHERE "channelId"=?', (ch['channelId'],))
        top_vids = get_top_videos(ch['channelId'], max_results=5,
                                    uploads_playlist_id=ch.get('uploads_pl', ''))
        vid_saved = 0
        for v in top_vids[:3]:
            vs = v.get('statistics', {}); vsnip = v.get('snippet', {})
            vd = v.get('contentDetails', {})
            pub_v = vsnip.get('publishedAt', '')
            pub_dt = datetime.fromisoformat(pub_v.replace('Z', '+00:00')) if pub_v else None
            save_video(conn, {
                'videoId': v['id'], 'channelId': ch['channelId'],
                'title': vsnip.get('title', ''),
                'thumbnailUrl': vsnip.get('thumbnails', {}).get('medium', {}).get('url', ''),
                'views': int(vs.get('viewCount', 0)),
                'duration': format_duration(vd.get('duration', 'PT0S')),
                'publishedAt': pub_dt,
            })
            vid_saved += 1
        print(f"       Videos saved: {vid_saved}/3")
        saved += 1

    total_lf = conn.execute('SELECT COUNT(*) FROM "Channel" WHERE "channelType"="long_form"').fetchone()[0]
    conn.close()

    print("\n" + "=" * 70)
    print(f"  Checked:       {total_checked} unique channels")
    print(f"  Skipped (dup): {skip_dup}  |  Too big: {skip_subs_big}  |  Too small: {skip_subs_small}")
    print(f"  Skipped (old/inactive): {skip_old}  |  Low score: {skip_score}")
    print(f"  Saved to DB:   {saved} channels")
    print(f"  Total long_form in DB: {total_lf}")
    print("=" * 70)

if __name__ == "__main__":
    main()
