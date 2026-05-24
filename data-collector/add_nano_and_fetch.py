"""
1. Add isNano column to Channel
2. Fetch channel info for given YouTube Shorts video IDs
3. Add them to DB as short_form + isNano=1
4. Find + add similar nano-shorts channels using remaining API quota
"""
import sys, io, sqlite3, requests, uuid, isodate
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from api_key_manager import APIKeyManager, safe_api_call
from dotenv import load_dotenv

load_dotenv()
DB = "../prisma/dev.db"

conn = sqlite3.connect(DB)
conn.execute("PRAGMA busy_timeout=30000")

# Add isNano column if missing
try:
    conn.execute('ALTER TABLE "Channel" ADD COLUMN isNano INTEGER NOT NULL DEFAULT 0')
    print("isNano column added")
except:
    print("isNano column already exists")
conn.commit()

km = APIKeyManager()
km.print_status()

def api(url, params):
    try:
        return safe_api_call(
            lambda key: requests.get(url, params={**params, "key": key}, timeout=15).json(), km
        )
    except Exception as e:
        print(f"  API error: {e}")
        return None

def fmt_dur(iso_d):
    try:
        t = int(isodate.parse_duration(iso_d).total_seconds())
        m, s = divmod(t, 60); h, m2 = divmod(m, 60)
        return f"{h}:{m2:02d}:{s:02d}" if h else f"{m}:{s:02d}"
    except: return "0:00"

# ── Video IDs from user-provided URLs ─────────────────────────────────────
SEED_VIDEO_IDS = [
    "I-jtbaQb7ss",  # Hair Cut
    "MGQCcDlySWU",  # Futuristic Pod
    "qz27g02QiGE",  # Dubai Museum
    "WuBERDJSbpc",  # JetPack Delivery
    "zaKmSUBog1U",  # Jumped Lava
    "1qYR1OSvpaI",  # Orange Cat is Bad
    "Nh6PYAMwIyM",  # Child Boss
    "0x72Puxn1yE",  # Cute Baby Doodi Dum
    "QOpfJGH-lKE",  # Tiny Judge
    "ilSgtk0g9gk",  # Baby Play Toy
    "aLAYfZRKcfk",  # Real Vs AI
]

# Also the handle-based channel
SEED_HANDLES = ["@MarvellaFamily"]

print(f"\nFetching channels for {len(SEED_VIDEO_IDS)} video IDs...")

# ── Step 1: Get channel IDs from video IDs ─────────────────────────────────
r = api("https://www.googleapis.com/youtube/v3/videos", {
    "part": "snippet,statistics,contentDetails",
    "id": ",".join(SEED_VIDEO_IDS),
    "maxResults": 50
})

channel_ids = set()
if r and r.get("items"):
    for item in r["items"]:
        ch_id = item.get("snippet", {}).get("channelId", "")
        if ch_id:
            channel_ids.add(ch_id)
    print(f"  Found {len(channel_ids)} channel IDs")

# Add MarvellaFamily by handle search
for handle in SEED_HANDLES:
    h = api("https://www.googleapis.com/youtube/v3/channels", {
        "part": "id,snippet,statistics",
        "forHandle": handle.lstrip("@"),
    })
    if h and h.get("items"):
        channel_ids.add(h["items"][0]["id"])
        print(f"  Found {handle} channel")

print(f"\nTotal seed channels: {len(channel_ids)}")

# ── Step 2: Search for similar nano-shorts channels ────────────────────────
NANO_SEARCH_QUERIES = [
    "nano shorts viral trending",
    "funny baby shorts viral",
    "satisfying shorts under 10 seconds",
    "wow moments shorts viral",
    "cute animal shorts funny",
    "magic tricks shorts viral",
    "life hack shorts",
    "before after shorts transformation",
    "food shorts amazing",
    "travel shorts amazing places",
    "funny cats dogs shorts",
    "science experiment shorts",
]

print(f"\nSearching for similar nano channels ({len(NANO_SEARCH_QUERIES)} queries)...")
for q in NANO_SEARCH_QUERIES:
    r2 = api("https://www.googleapis.com/youtube/v3/search", {
        "part": "snippet",
        "q": q,
        "type": "video",
        "videoDuration": "short",
        "maxResults": 10,
        "order": "viewCount",
    })
    if r2 and r2.get("items"):
        for item in r2["items"]:
            ch_id = item.get("snippet", {}).get("channelId", "")
            if ch_id:
                channel_ids.add(ch_id)

print(f"Total channels to process: {len(channel_ids)}")

# ── Step 3: Get full channel details and store in DB ───────────────────────
ch_ids_list = list(channel_ids)
saved = 0

for i in range(0, len(ch_ids_list), 50):
    batch = ch_ids_list[i:i+50]
    cr = api("https://www.googleapis.com/youtube/v3/channels", {
        "part": "snippet,statistics,contentDetails",
        "id": ",".join(batch),
        "maxResults": 50,
    })
    if not cr or not cr.get("items"):
        continue

    for ch in cr["items"]:
        ch_id = ch["id"]
        snip = ch.get("snippet", {})
        stats = ch.get("statistics", {})
        subs = int(stats.get("subscriberCount", 0))
        total_vids = int(stats.get("videoCount", 0))
        total_views = int(stats.get("viewCount", 0))
        thumb = snip.get("thumbnails", {}).get("default", {}).get("url", "")
        name = snip.get("title", "")
        handle = snip.get("customUrl", "")
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
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,1,0,0,0,0,1,1,datetime('now'),datetime('now'))
            """, (
                str(uuid.uuid4()), ch_id, name, handle, thumb,
                subs, total_vids, total_views, "short_form", "Entertainment",
                avg_views, outlier
            ))
            # Mark existing short_form channels as isNano too (if applicable)
            conn.execute("""
                UPDATE "Channel" SET isNano=1, channelType='short_form'
                WHERE channelId=?
            """, (ch_id,))
            saved += 1
        except Exception as e:
            print(f"  DB error for {name}: {e}")

conn.commit()

# ── Step 4: Fetch top 10 videos for nano channels ──────────────────────────
print(f"\nFetching videos for {saved} channels...")
vid_count = 0

for ch_id in ch_ids_list[:50]:  # limit to quota
    vr = api("https://www.googleapis.com/youtube/v3/search", {
        "part": "snippet",
        "channelId": ch_id,
        "type": "video",
        "videoDuration": "short",
        "maxResults": 10,
        "order": "viewCount",
    })
    if not vr or not vr.get("items"):
        continue

    video_ids = [item["id"]["videoId"] for item in vr["items"] if item.get("id", {}).get("videoId")]
    if not video_ids:
        continue

    vd = api("https://www.googleapis.com/youtube/v3/videos", {
        "part": "snippet,statistics,contentDetails",
        "id": ",".join(video_ids),
    })
    if not vd or not vd.get("items"):
        continue

    conn.execute('DELETE FROM "Video" WHERE channelId=?', (ch_id,))
    for v in vd["items"][:10]:
        vs = v.get("statistics", {})
        vsnip = v.get("snippet", {})
        vcd = v.get("contentDetails", {})
        dur = fmt_dur(vcd.get("duration", "PT0S"))
        dur_secs = 0
        try:
            dur_secs = int(isodate.parse_duration(vcd.get("duration","PT0S")).total_seconds())
        except: pass

        pub = vsnip.get("publishedAt", "")
        pub_dt = None
        if pub:
            from datetime import datetime, timezone
            pub_dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))

        is_nano = 1 if dur_secs <= 12 else 0

        conn.execute("""
            INSERT OR IGNORE INTO "Video"
            (id, videoId, channelId, title, thumbnailUrl, views, duration, publishedAt, isOutlier, isNano)
            VALUES (?,?,?,?,?,?,?,?,0,?)
        """, (
            str(uuid.uuid4()), v["id"], ch_id,
            vsnip.get("title", ""),
            vsnip.get("thumbnails", {}).get("medium", {}).get("url", ""),
            int(vs.get("viewCount", 0)),
            dur, pub_dt, is_nano
        ))
        vid_count += 1

conn.commit()

total_ch = conn.execute('SELECT COUNT(*) FROM "Channel" WHERE channelType="short_form" AND isNano=1').fetchone()[0]
total_v = conn.execute('SELECT COUNT(*) FROM "Video" WHERE isNano=1').fetchone()[0]
print(f"\nNano channels in DB: {total_ch}")
print(f"Nano videos in DB:   {total_v}")
km.print_status()
conn.close()
print("DONE")
