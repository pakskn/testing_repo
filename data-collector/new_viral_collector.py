"""
New & Viral Channel Collector — v2
===================================
Finds long_form channels:
  - Created OR uploaded in last 30 days
  - Subscribers: 1K to 20K (growing, not famous yet)
  - Outlier Score: 2x to 100x+ (avg_views / subscribers)
  - Any language | Faceless niches only

Quota usage: ~3 units/channel (efficient playlist method)
"""
import sys, io, sqlite3, uuid, requests, isodate
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
load_dotenv()

API_KEY  = os.getenv('YOUTUBE_API_KEY')
DB_PATH  = '../next-app/prisma/dev.db'  # actual data DB (123 channels)

# ── Thresholds ──────────────────────────────────────────
MIN_SUBS    = 1_000
MAX_SUBS    = 100_000
MIN_OUTLIER = 1.5
DAYS_ACTIVE = 120
TARGET      = 60

# ── Broad Faceless Niches — Any Language ────────────────
SEARCH_QUERIES = [
    # HFy / Reddit Stories
    ("hfy reddit stories narrated animated",             "HFy Stories"),
    ("reddit relationship story narrated channel",       "Reddit Stories"),
    ("aita reddit story narrated animated",              "Reddit Stories"),
    ("malicious compliance reddit narrated",             "Reddit Stories"),
    ("entitled people story narrated",                   "Reddit Stories"),
    ("pro revenge story narrated channel",               "Revenge Stories"),
    ("r/relationship_advice narrated story",             "Reddit Stories"),

    # Horror / Scary
    ("horror story narrated animated channel",           "Horror"),
    ("scary paranormal stories narrated",                "Horror"),
    ("creepy true horror story narrated",                "Horror"),
    ("horror story animation faceless channel",          "Horror"),

    # True Crime
    ("true crime documentary narrated channel",          "Crime"),
    ("real crime case documentary narrated",             "Crime"),
    ("criminal case true crime narration",               "Crime"),

    # AI Content
    ("ai colorization restored old footage",             "AI Restoration"),
    ("ai restored historical video channel",             "AI Restoration"),
    ("ai future technology scenario channel",            "AI"),
    ("artificial intelligence animated documentary",     "AI"),

    # History — Any Language
    ("history documentary animated channel",             "History"),
    ("ancient history narrated animation",               "History"),
    ("historical events documentary faceless",           "History"),
    ("military history narrated documentary",            "History"),

    # Motivation / Self Help
    ("motivational speech animated channel",             "Motivation"),
    ("stoicism animated explained channel",              "Motivation"),
    ("self improvement animated motivation",             "Self Improvement"),
    ("mindset success animated stories",                 "Motivation"),

    # Finance
    ("finance money explained animated channel",         "Finance"),
    ("cryptocurrency bitcoin explained animated",        "Finance"),
    ("stock market explained animated faceless",         "Finance"),
    ("millionaire success story animated",               "Finance"),

    # Science / Space
    ("space universe documentary animated",              "Space"),
    ("black hole science explained animation",           "Space"),
    ("science facts explained animated channel",         "Science"),
    ("physics chemistry animated explained",             "Science"),

    # Psychology / Mind
    ("psychology facts animated channel",                "Psychology"),
    ("human behavior psychology explained",              "Psychology"),
    ("dark psychology facts narrated channel",           "Psychology"),

    # Conspiracy / Mystery
    ("conspiracy theory animated documentary",           "Conspiracy"),
    ("unsolved mystery narrated animated",               "Conspiracy"),
    ("ancient mystery unexplained documentary",          "Conspiracy"),

    # Survival
    ("survival tips wilderness animated channel",        "Survival"),
    ("disaster survival documentary narrated",           "Survival"),
    ("extreme survival story animated",                  "Survival"),

    # Nature / Wildlife
    ("nature wildlife documentary narrated faceless",    "Wildlife"),
    ("deep ocean sea creatures narrated",                "Nature"),
    ("predator prey nature animated",                    "Wildlife"),

    # Business / Entrepreneur
    ("business story animated faceless channel",         "Business"),
    ("entrepreneur success story animated",              "Business"),
    ("startup failure success documentary",              "Business"),

    # Health / Medical
    ("medical case animated explained channel",          "Health"),
    ("health body facts animated",                       "Health"),
    ("nutrition diet facts animated channel",            "Health"),

    # Exploration / Mystery Places
    ("abandoned places mystery documentary",             "Exploration"),
    ("lost civilization documentary narrated",           "Exploration"),
    ("ancient ruins mystery documentary",                "Exploration"),

    # New / Trending
    ("new faceless channel 2025 narrated",               "HFy Stories"),
    ("animated educational channel 2025",                "Education"),
    ("voiceover documentary channel 2025",               "Education"),
]

# ─────────────────────────────────────────────────────────
def search_channels(query, max_results=10):
    r = requests.get("https://www.googleapis.com/youtube/v3/search", params={
        "part": "snippet", "type": "channel",
        "q": query, "maxResults": max_results, "key": API_KEY,
    }).json()
    if r.get("error"):
        print(f"    ⚠️  API Error: {r['error']['code']} — {r['error']['message'][:60]}")
        return []
    return [item['id']['channelId'] for item in r.get('items', [])]

def get_channel_full(channel_id):
    r = requests.get("https://www.googleapis.com/youtube/v3/channels", params={
        "part": "snippet,statistics,contentDetails",
        "id": channel_id, "key": API_KEY,
    }).json()
    return r['items'][0] if r.get('items') else None

def get_latest_upload_date(uploads_playlist_id):
    r = requests.get("https://www.googleapis.com/youtube/v3/playlistItems", params={
        "part": "snippet", "playlistId": uploads_playlist_id,
        "maxResults": 1, "key": API_KEY,
    }).json()
    items = r.get('items', [])
    if not items: return None
    pub = items[0]['snippet'].get('publishedAt', '')
    return datetime.fromisoformat(pub.replace('Z', '+00:00')) if pub else None

def get_top_videos(channel_id, uploads_playlist_id, max_results=5):
    pl = requests.get("https://www.googleapis.com/youtube/v3/playlistItems", params={
        "part": "snippet", "playlistId": uploads_playlist_id,
        "maxResults": max_results * 3, "key": API_KEY,
    }).json()
    items = pl.get("items", [])
    if not items: return []
    vids = [i["snippet"]["resourceId"]["videoId"] for i in items
            if i["snippet"].get("resourceId", {}).get("kind") == "youtube#video"]
    if not vids: return []
    vr = requests.get("https://www.googleapis.com/youtube/v3/videos", params={
        "part": "snippet,statistics,contentDetails",
        "id": ",".join(vids[:50]), "key": API_KEY,
    }).json()
    videos = vr.get("items", [])
    videos.sort(key=lambda v: int(v.get("statistics", {}).get("viewCount", 0)), reverse=True)
    return videos[:max_results]

def format_duration(iso_d):
    try:
        t = int(isodate.parse_duration(iso_d).total_seconds())
        m, s = divmod(t, 60); h, m = divmod(m, 60)
        return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"
    except: return "0:00"

def already_exists(conn, ch_id):
    return conn.execute('SELECT 1 FROM "Channel" WHERE "channelId"=?', (ch_id,)).fetchone() is not None

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
            "channelName"=excluded."channelName","thumbnailUrl"=excluded."thumbnailUrl",
            "subscribers"=excluded."subscribers","totalVideos"=excluded."totalVideos",
            "totalViews"=excluded."totalViews","avgViewsPerVideo"=excluded."avgViewsPerVideo",
            "outlierScore"=excluded."outlierScore","isMonetized"=excluded."isMonetized",
            "updatedAt"=excluded."updatedAt"
    """, (str(uuid.uuid4()), data['channelId'], data['channelName'], data['channelHandle'],
          data['thumbnailUrl'], data['subscribers'], data['totalVideos'], data['totalViews'],
          'long_form', data['niche'], data['daysSinceStart'], data['avgViewsPerVideo'],
          data['outlierScore'], 1 if data['isMonetized'] else 0, now, now))
    conn.commit()

def save_video(conn, data):
    pub = data['publishedAt'].isoformat() if data['publishedAt'] else None
    conn.execute("""
        INSERT INTO "Video" ("id","videoId","channelId","title","thumbnailUrl","views","duration","publishedAt")
        VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT ("videoId") DO UPDATE SET "views"=excluded."views","title"=excluded."title","thumbnailUrl"=excluded."thumbnailUrl"
    """, (str(uuid.uuid4()), data['videoId'], data['channelId'], data['title'],
          data['thumbnailUrl'], data['views'], data['duration'], pub))
    conn.commit()

# ─────────────────────────────────────────────────────────
def main():
    print("=" * 70)
    print("  New & Viral Faceless Channel Finder — v2")
    print(f"  Subs: {MIN_SUBS:,} – {MAX_SUBS:,}  |  Outlier: {MIN_OUTLIER}x+")
    print(f"  Active in last {DAYS_ACTIVE} days  |  Target: {TARGET} channels")
    print("=" * 70)

    conn    = sqlite3.connect(DB_PATH)
    cutoff  = datetime.now(timezone.utc) - timedelta(days=DAYS_ACTIVE)
    seen    = set()
    results = []
    checked = dup = big = small = old = low_score = 0

    for query, niche in SEARCH_QUERIES:
        if len(results) >= TARGET * 2:
            break

        print(f"\n  🔍 {query[:55]}...")
        ch_ids = search_channels(query, max_results=10)

        for ch_id in ch_ids:
            if ch_id in seen: continue
            seen.add(ch_id)
            checked += 1

            if already_exists(conn, ch_id):
                dup += 1; continue

            info = get_channel_full(ch_id)
            if not info: continue

            sn    = info.get('snippet', {})
            st    = info.get('statistics', {})
            cd    = info.get('contentDetails', {})
            name  = sn.get('title', '')
            subs  = int(st.get('subscriberCount', 0))
            vids  = int(st.get('videoCount', 0))
            views = int(st.get('viewCount', 0))

            if subs < MIN_SUBS:  small += 1; continue
            if subs > MAX_SUBS:  big   += 1; continue

            # Channel creation date
            pub_str = sn.get('publishedAt', '')
            if pub_str:
                ch_created = datetime.fromisoformat(pub_str.replace('Z', '+00:00'))
                days_since = (datetime.now(timezone.utc) - ch_created).days
                channel_new = ch_created >= cutoff
            else:
                days_since = 0; channel_new = False

            # Last upload date
            uploads_pl = cd.get('relatedPlaylists', {}).get('uploads', '')
            last_upload = get_latest_upload_date(uploads_pl) if uploads_pl else None
            recently_active = last_upload and last_upload >= cutoff

            if not channel_new and not recently_active:
                old += 1; continue

            # Outlier score
            avg_views = round(views / vids, 2) if vids > 0 else 0
            outlier   = round(avg_views / subs, 2) if subs > 0 else 0

            if outlier < MIN_OUTLIER:
                low_score += 1
                print(f"    ⚡ {name[:32]:32} | {subs:>6,} subs | {outlier:.1f}x (low)")
                continue

            activity = f"NEW {days_since}d" if channel_new else f"Active {(datetime.now(timezone.utc)-last_upload).days}d ago"
            results.append({
                'channelId': ch_id, 'channelName': name,
                'channelHandle': sn.get('customUrl', ''),
                'thumbnailUrl': sn.get('thumbnails', {}).get('default', {}).get('url', ''),
                'subscribers': subs, 'totalVideos': vids, 'totalViews': views,
                'niche': niche, 'daysSinceStart': days_since,
                'avgViewsPerVideo': avg_views, 'outlierScore': outlier,
                'isMonetized': subs >= 1000,
                'uploads_pl': uploads_pl, 'activity': activity,
            })
            icon = '🟢' if outlier >= 10 else ('🟡' if outlier >= 5 else '🔵')
            print(f"    {icon} FOUND: {name[:32]:32} | {subs:>6,} subs | {outlier:.2f}x | {activity}")

    # Sort by outlier score
    results.sort(key=lambda x: x['outlierScore'], reverse=True)
    top = results[:TARGET]

    print("\n" + "=" * 70)
    print(f"  TOP {len(top)} RESULTS — sorted by Outlier Score")
    print("=" * 70)

    saved = 0
    for i, ch in enumerate(top, 1):
        icon = '🟢' if ch['outlierScore'] >= 10 else ('🟡' if ch['outlierScore'] >= 5 else '🔵')
        print(f"\n  #{i:02d} {icon} {ch['channelName'][:40]}")
        print(f"       {ch['niche']:<18} | {ch['subscribers']:>6,} subs | {ch['outlierScore']:.2f}x | {ch['activity']}")

        save_channel(conn, ch)
        conn.execute('DELETE FROM "Video" WHERE "channelId"=?', (ch['channelId'],))

        vids_saved = 0
        for v in get_top_videos(ch['channelId'], ch.get('uploads_pl', ''), max_results=5)[:3]:
            vs = v.get('statistics', {}); vsnip = v.get('snippet', {}); vd = v.get('contentDetails', {})
            pub_v = vsnip.get('publishedAt', '')
            save_video(conn, {
                'videoId': v['id'], 'channelId': ch['channelId'],
                'title': vsnip.get('title', ''),
                'thumbnailUrl': vsnip.get('thumbnails', {}).get('medium', {}).get('url', ''),
                'views': int(vs.get('viewCount', 0)),
                'duration': format_duration(vd.get('duration', 'PT0S')),
                'publishedAt': datetime.fromisoformat(pub_v.replace('Z', '+00:00')) if pub_v else None,
            })
            vids_saved += 1
        print(f"       ✓ {vids_saved} videos saved")
        saved += 1

    total_lf = conn.execute('SELECT COUNT(*) FROM "Channel" WHERE "channelType"="long_form"').fetchone()[0]
    conn.close()

    print("\n" + "=" * 70)
    print(f"  Checked: {checked}  |  Dup: {dup}  |  Too big: {big}  |  Too small: {small}")
    print(f"  Old/inactive: {old}  |  Low outlier: {low_score}")
    print(f"  SAVED: {saved} channels  |  Total long_form in DB: {total_lf}")
    print("=" * 70)

if __name__ == "__main__":
    main()
