"""
Today's quota fetch — 2 jobs:
1. Find MORE shorts channels (similar to existing nano/short channels)
2. Fetch/refresh 10 videos per channel for ALL short_form channels

Uses both API keys = up to 20,000 units.
"""
import sys, io, sqlite3, uuid, requests, isodate, time, random
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from api_key_manager import APIKeyManager, safe_api_call
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()
DB = "../prisma/dev.db"

conn = sqlite3.connect(DB)
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA busy_timeout=60000")

km = APIKeyManager()
km.print_status()

def api(url, params):
    try:
        return safe_api_call(
            lambda key: requests.get(url, params={**params, "key": key}, timeout=15).json(), km
        )
    except Exception as e:
        return None

def fmt_dur(iso_d):
    try:
        t = int(isodate.parse_duration(iso_d).total_seconds())
        m, s = divmod(t, 60); h, m2 = divmod(m, 60)
        return f"{h}:{m2:02d}:{s:02d}" if h else f"{m}:{s:02d}"
    except: return "0:00"

def dur_secs(iso_d):
    try: return int(isodate.parse_duration(iso_d).total_seconds())
    except: return 0

# ── Job 1: Find more shorts channels ──────────────────────────────────────
print("\n=== JOB 1: Finding more shorts channels ===")

SHORTS_QUERIES = [
    "satisfying shorts viral 2024",
    "funny moments shorts viral",
    "life hacks shorts 60 seconds",
    "before after transformation shorts",
    "wow reaction shorts trending",
    "cute animals shorts funny",
    "food cooking shorts recipe",
    "travel adventure shorts amazing",
    "science experiment shorts wow",
    "sports highlights shorts amazing",
    "magic trick shorts illusion",
    "prank shorts funny reaction",
    "asmr shorts satisfying",
    "motivational shorts 60 seconds",
    "facts shorts did you know",
    "historical shorts amazing facts",
    "technology shorts future",
    "art drawing shorts satisfying",
    "fitness workout shorts quick",
    "comedy skit shorts funny",
]

new_channel_ids = set()

# Also get channels similar to existing short_form channels
existing = conn.execute(
    'SELECT channelId FROM Channel WHERE channelType="short_form" AND isNano=1 LIMIT 20'
).fetchall()
for (ch_id,) in existing:
    r = api("https://www.googleapis.com/youtube/v3/search", {
        "part": "snippet",
        "relatedToVideoId": ch_id,
        "type": "video",
        "videoDuration": "short",
        "maxResults": 5,
        "order": "viewCount",
    })
    # relatedToVideoId may fail, skip errors

for q in SHORTS_QUERIES[:15]:  # ~15 searches × 100 units = 1500 units
    r = api("https://www.googleapis.com/youtube/v3/search", {
        "part": "snippet",
        "q": q,
        "type": "video",
        "videoDuration": "short",
        "maxResults": 10,
        "order": "viewCount",
    })
    if r and r.get("items"):
        for item in r["items"]:
            ch_id = item.get("snippet", {}).get("channelId", "")
            if ch_id:
                new_channel_ids.add(ch_id)
    time.sleep(0.1)

print(f"Found {len(new_channel_ids)} potential new channels")

# Get details and add to DB
added = 0
for i in range(0, len(new_channel_ids), 50):
    batch = list(new_channel_ids)[i:i+50]
    cr = api("https://www.googleapis.com/youtube/v3/channels", {
        "part": "snippet,statistics",
        "id": ",".join(batch),
        "maxResults": 50,
    })
    if not cr or not cr.get("items"):
        continue
    for ch in cr["items"]:
        ch_id = ch["id"]
        # Skip if already in DB
        exists = conn.execute('SELECT 1 FROM Channel WHERE channelId=?', (ch_id,)).fetchone()
        if exists:
            continue
        snip = ch.get("snippet", {})
        stats = ch.get("statistics", {})
        subs = int(stats.get("subscriberCount", 0))
        total_vids = int(stats.get("videoCount", 0))
        total_views = int(stats.get("viewCount", 0))
        thumb = snip.get("thumbnails", {}).get("default", {}).get("url", "")
        if not thumb:
            continue
        avg_views = total_views // max(total_vids, 1)
        outlier = avg_views / max(subs, 1)
        try:
            conn.execute("""
                INSERT OR IGNORE INTO "Channel"
                (id, channelId, channelName, channelHandle, thumbnailUrl,
                 subscribers, totalVideos, totalViews, channelType, niche,
                 avgViewsPerVideo, outlierScore, isMonetized, isActive,
                 isKids, isNews, isEntertainment, isFaceless, isNano, sortOrder,
                 createdAt, updatedAt)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,1,0,0,0,0,0,1,datetime('now'),datetime('now'))
            """, (
                str(uuid.uuid4()), ch_id,
                snip.get("title", ""),
                snip.get("customUrl", ""),
                thumb, subs, total_vids, total_views,
                "short_form", "Entertainment",
                avg_views, outlier
            ))
            added += 1
        except: pass

conn.commit()
print(f"New short_form channels added: {added}")

# ── Job 2: Fetch 10 videos per short_form channel ─────────────────────────
print("\n=== JOB 2: Fetching 10 videos per channel ===")

# Get all short_form channels ordered by outlier score (best first)
channels = conn.execute("""
    SELECT channelId, channelName, subscribers, outlierScore
    FROM Channel
    WHERE channelType='short_form' AND isActive=1
    ORDER BY outlierScore DESC, subscribers DESC
    LIMIT 2000
""").fetchall()

print(f"Short_form channels to process: {len(channels)}")

saved = net_err = api_err = vid_count = 0
start = datetime.now()

for i, (ch_id, name, subs, outlier) in enumerate(channels):
    # Get uploads playlist
    r = api("https://www.googleapis.com/youtube/v3/channels", {
        "part": "contentDetails",
        "id": ch_id,
    })
    if not r or not r.get("items"):
        api_err += 1; continue

    uploads_pl = r["items"][0].get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads", "")
    if not uploads_pl:
        api_err += 1; continue

    # Get playlist items (fetch 30 to pick best 10)
    pl = api("https://www.googleapis.com/youtube/v3/playlistItems", {
        "part": "snippet",
        "playlistId": uploads_pl,
        "maxResults": 30,
    })
    if not pl or pl.get("error", {}).get("code") == 403:
        if pl and pl.get("error", {}).get("code") == 403:
            print("  Quota exceeded — stopping")
            break
        api_err += 1; continue

    items = pl.get("items", [])
    vids = [item["snippet"]["resourceId"]["videoId"] for item in items
            if item["snippet"].get("resourceId", {}).get("kind") == "youtube#video"]
    if not vids:
        api_err += 1; continue

    # Get video details
    vr = api("https://www.googleapis.com/youtube/v3/videos", {
        "part": "snippet,statistics,contentDetails",
        "id": ",".join(vids[:30]),
    })
    if not vr or vr.get("error"):
        api_err += 1; continue

    all_vids = vr.get("items", [])

    # For shorts: prefer short videos (< 180s)
    short_vids = [v for v in all_vids
                  if dur_secs(v.get("contentDetails", {}).get("duration", "PT0S")) <= 180]
    working = short_vids if short_vids else all_vids

    # 4 most popular + 3 recent + 3 random
    by_views = sorted(working, key=lambda v: int(v.get("statistics", {}).get("viewCount", 0)), reverse=True)
    popular = by_views[:4]
    used = {v["id"] for v in popular}
    by_date = sorted(working, key=lambda v: v.get("snippet", {}).get("publishedAt", ""), reverse=True)
    recent = [v for v in by_date if v["id"] not in used][:3]
    used.update(v["id"] for v in recent)
    remaining = [v for v in working if v["id"] not in used]
    rand_vids = random.sample(remaining, min(3, len(remaining)))
    final = popular + recent + rand_vids

    conn.execute('DELETE FROM "Video" WHERE channelId=?', (ch_id,))
    for v in final:
        vs = v.get("statistics", {})
        vsnip = v.get("snippet", {})
        vcd = v.get("contentDetails", {})
        d_secs = dur_secs(vcd.get("duration", "PT0S"))
        is_nano = 1 if d_secs <= 12 else 0
        pub = vsnip.get("publishedAt", "")
        pub_dt = datetime.fromisoformat(pub.replace("Z", "+00:00")) if pub else None

        try:
            conn.execute("""
                INSERT OR IGNORE INTO "Video"
                (id, videoId, channelId, title, thumbnailUrl, views, duration, publishedAt, isOutlier, isNano)
                VALUES (?,?,?,?,?,?,?,?,0,?)
            """, (
                str(uuid.uuid4()), v["id"], ch_id,
                vsnip.get("title", ""),
                vsnip.get("thumbnails", {}).get("medium", {}).get("url", ""),
                int(vs.get("viewCount", 0)),
                fmt_dur(vcd.get("duration", "PT0S")),
                pub_dt, is_nano
            ))
            vid_count += 1
        except: pass

    # Update channel isNano flag based on videos
    if short_vids and all(dur_secs(v.get("contentDetails", {}).get("duration", "PT0S")) <= 12 for v in short_vids[:3]):
        conn.execute('UPDATE Channel SET isNano=1 WHERE channelId=?', (ch_id,))

    conn.commit()
    saved += 1

    if saved % 50 == 0:
        elapsed = (datetime.now() - start).seconds
        print(f"  [{saved}/{len(channels)}] {name[:30]:30} | {subs:>7,} subs | {vid_count} vids | {elapsed}s")

# Final stats
total_ch = conn.execute('SELECT COUNT(DISTINCT channelId) FROM Video v JOIN Channel c ON v.channelId=c.channelId WHERE c.channelType="short_form"').fetchone()[0]
total_v = conn.execute('SELECT COUNT(*) FROM Video v JOIN Channel c ON v.channelId=c.channelId WHERE c.channelType="short_form"').fetchone()[0]
print(f"\nDone: {saved} channels processed, {vid_count} videos fetched")
print(f"Short_form channels with videos: {total_ch}")
print(f"Short_form total videos: {total_v}")
km.print_status()
conn.close()
print("ALL DONE")
