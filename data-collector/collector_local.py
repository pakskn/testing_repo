"""
YouTube Niche Finder — LOCAL collector (SQLite)
Connects to the same dev.db that Next.js uses locally.
For VPS/production, use collector.py (PostgreSQL).
"""

import sys
import io
import requests
import sqlite3
import uuid
from datetime import datetime, timezone

# Force UTF-8 output so Unicode icons work on Windows terminal
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import isodate
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("YOUTUBE_API_KEY")
DB_PATH = os.getenv("DATABASE_URL", "../next-app/prisma/dev.db")

# Strip "file:" prefix if present (Prisma uses file:./dev.db)
if DB_PATH.startswith("file:"):
    DB_PATH = DB_PATH[5:]


# ─── YouTube API helpers ──────────────────────────────────────────────────────

def get_channel_info(channel_id):
    url = "https://www.googleapis.com/youtube/v3/channels"
    params = {
        "part": "snippet,statistics,contentDetails",
        "id": channel_id,
        "key": API_KEY,
    }
    r = requests.get(url, params=params).json()
    if not r.get("items"):
        return None
    return r["items"][0]


def get_top_videos(channel_id, max_results=8, short_form=False, uploads_playlist_id=None):
    """
    QUOTA-EFFICIENT version:
    Uses playlistItems.list (1 unit) instead of search.list (100 units)
    Then sorts by viewCount using videos.list (1 unit for all IDs).
    Total: ~2 units per channel instead of 101 units.
    """
    # Step 1: Get uploads playlist ID if not provided (from get_channel_info)
    if not uploads_playlist_id:
        ch = get_channel_info(channel_id)
        if not ch:
            return []
        uploads_playlist_id = ch.get('contentDetails', {}).get('relatedPlaylists', {}).get('uploads', '')

    if not uploads_playlist_id:
        return []

    # Step 2: Get recent videos from uploads playlist — 1 UNIT only
    pl_params = {
        "part": "snippet",
        "playlistId": uploads_playlist_id,
        "maxResults": max_results * 2,   # fetch more so we can sort by views
        "key": API_KEY,
    }
    if short_form:
        pl_params["maxResults"] = max_results * 3

    pl_res = requests.get("https://www.googleapis.com/youtube/v3/playlistItems", params=pl_params).json()
    items = pl_res.get("items", [])
    if not items:
        return []

    # Extract video IDs
    video_ids = [
        item["snippet"]["resourceId"]["videoId"]
        for item in items
        if item["snippet"].get("resourceId", {}).get("kind") == "youtube#video"
    ]
    if not video_ids:
        return []

    # Step 3: Get video details (views, duration) — 1 UNIT for all IDs
    video_res = requests.get(
        "https://www.googleapis.com/youtube/v3/videos",
        params={
            "part": "snippet,statistics,contentDetails",
            "id": ",".join(video_ids[:min(len(video_ids), 50)]),
            "key": API_KEY,
        }
    ).json()
    videos = video_res.get("items", [])

    # Step 4: Sort by viewCount descending (most popular first)
    videos.sort(key=lambda v: int(v.get("statistics", {}).get("viewCount", 0)), reverse=True)

    # Step 5: If short_form, filter by duration < 4 minutes
    if short_form:
        try:
            import isodate as _iso
            def _secs(iso_d):
                try: return int(_iso.parse_duration(iso_d).total_seconds())
                except: return 9999
            videos = [v for v in videos
                      if _secs(v.get("contentDetails", {}).get("duration", "PT0S")) < 240]
        except ImportError:
            pass

    return videos[:max_results]


# ─── Calculation helpers ──────────────────────────────────────────────────────

def calculate_outlier_score(avg_views, subscribers):
    if subscribers == 0:
        return 0.0
    return round(avg_views / subscribers, 2)


def format_duration(iso_duration):
    try:
        duration = isodate.parse_duration(iso_duration)
        total_seconds = int(duration.total_seconds())
        minutes, seconds = divmod(total_seconds, 60)
        hours, minutes = divmod(minutes, 60)
        if hours > 0:
            return f"{hours}:{minutes:02d}:{seconds:02d}"
        return f"{minutes}:{seconds:02d}"
    except Exception:
        return "0:00"


def classify_channel_type(avg_duration_seconds, last_upload_days):
    if last_upload_days <= 2:
        return "real_time"
    if avg_duration_seconds < 90:
        return "short_form"
    return "long_form"


# ─── Database helpers (SQLite) ────────────────────────────────────────────────

def save_channel(conn, data):
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("""
        INSERT INTO "Channel" (
            "id", "channelId", "channelName", "channelHandle",
            "thumbnailUrl", "subscribers", "totalVideos", "totalViews",
            "channelType", "niche", "daysSinceStart", "avgViewsPerVideo",
            "outlierScore", "isMonetized", "createdAt", "updatedAt"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT ("channelId") DO UPDATE SET
            "channelName"      = excluded."channelName",
            "channelHandle"    = excluded."channelHandle",
            "thumbnailUrl"     = excluded."thumbnailUrl",
            "subscribers"      = excluded."subscribers",
            "totalVideos"      = excluded."totalVideos",
            "totalViews"       = excluded."totalViews",
            "channelType"      = excluded."channelType",
            "niche"            = excluded."niche",
            "avgViewsPerVideo" = excluded."avgViewsPerVideo",
            "outlierScore"     = excluded."outlierScore",
            "isMonetized"      = excluded."isMonetized",
            "updatedAt"        = excluded."updatedAt"
    """, (
        str(uuid.uuid4()),
        data["channelId"],
        data["channelName"],
        data["channelHandle"],
        data["thumbnailUrl"],
        data["subscribers"],
        data["totalVideos"],
        data["totalViews"],
        data["channelType"],
        data["niche"],
        data["daysSinceStart"],
        data["avgViewsPerVideo"],
        data["outlierScore"],
        1 if data["isMonetized"] else 0,
        now,
        now,
    ))
    conn.commit()


def save_video(conn, data):
    pub_at = data["publishedAt"].isoformat() if data["publishedAt"] else None
    conn.execute("""
        INSERT INTO "Video" (
            "id", "videoId", "channelId", "title",
            "thumbnailUrl", "views", "duration", "publishedAt"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT ("videoId") DO UPDATE SET
            "views" = excluded."views",
            "title" = excluded."title",
            "thumbnailUrl" = excluded."thumbnailUrl"
    """, (
        str(uuid.uuid4()),
        data["videoId"],
        data["channelId"],
        data["title"],
        data["thumbnailUrl"],
        data["views"],
        data["duration"],
        pub_at,
    ))
    conn.commit()


# ─── Main processing ──────────────────────────────────────────────────────────

def process_channel(conn, channel_id, niche, channel_type_override=None):
    print(f"  → Fetching: {channel_id}")
    info = get_channel_info(channel_id)
    if not info:
        print(f"    ✗ Not found or private: {channel_id}")
        return False

    snippet     = info.get("snippet", {})
    stats       = info.get("statistics", {})
    name        = snippet.get("title", "")
    handle      = snippet.get("customUrl", "")
    thumbnail   = snippet.get("thumbnails", {}).get("default", {}).get("url", "")
    subscribers = int(stats.get("subscriberCount", 0))
    total_vids  = int(stats.get("videoCount", 0))
    total_views = int(stats.get("viewCount", 0))

    pub = snippet.get("publishedAt", "")
    if pub:
        created    = datetime.fromisoformat(pub.replace("Z", "+00:00"))
        days_since = (datetime.now(timezone.utc) - created).days
    else:
        days_since = 0

    avg_views     = round(total_views / total_vids, 2) if total_vids > 0 else 0
    outlier_score = calculate_outlier_score(avg_views, subscribers)
    is_short_form = channel_type_override == 'short_form'

    # Pass uploads_playlist_id from already-fetched channel info — saves 1 unit
    uploads_pl = info.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads", "")
    videos = get_top_videos(channel_id, max_results=8,
                            short_form=is_short_form,
                            uploads_playlist_id=uploads_pl)

    if channel_type_override:
        ch_type = channel_type_override
    else:
        durations        = []
        last_upload_days = 999
        for v in videos:
            iso_dur = v.get("contentDetails", {}).get("duration", "PT0S")
            try:
                durations.append(int(isodate.parse_duration(iso_dur).total_seconds()))
            except Exception:
                pass
            pub_v = v.get("snippet", {}).get("publishedAt", "")
            if pub_v:
                pub_dt           = datetime.fromisoformat(pub_v.replace("Z", "+00:00"))
                last_upload_days = min(last_upload_days, (datetime.now(timezone.utc) - pub_dt).days)
        avg_dur = sum(durations) / len(durations) if durations else 0
        ch_type = classify_channel_type(avg_dur, last_upload_days)

    save_channel(conn, {
        "channelId":        channel_id,
        "channelName":      name,
        "channelHandle":    handle,
        "thumbnailUrl":     thumbnail,
        "subscribers":      subscribers,
        "totalVideos":      total_vids,
        "totalViews":       total_views,
        "channelType":      ch_type,
        "niche":            niche,
        "daysSinceStart":   days_since,
        "avgViewsPerVideo": avg_views,
        "outlierScore":     outlier_score,
        "isMonetized":      subscribers >= 1000,
    })

    # Delete old videos for this channel then re-insert top 3
    conn.execute('DELETE FROM "Video" WHERE "channelId" = ?', (channel_id,))
    conn.commit()

    for v in videos[:3]:
        v_stats   = v.get("statistics", {})
        v_snippet = v.get("snippet", {})
        v_details = v.get("contentDetails", {})
        pub_v     = v_snippet.get("publishedAt", "")
        pub_dt    = datetime.fromisoformat(pub_v.replace("Z", "+00:00")) if pub_v else None
        save_video(conn, {
            "videoId":      v["id"],
            "channelId":    channel_id,
            "title":        v_snippet.get("title", ""),
            "thumbnailUrl": v_snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
            "views":        int(v_stats.get("viewCount", 0)),
            "duration":     format_duration(v_details.get("duration", "PT0S")),
            "publishedAt":  pub_dt,
        })

    score_icon = "🟢" if outlier_score >= 5 else ("🟡" if outlier_score >= 2 else "🔴")
    print(f"    {score_icon} {name} | {subscribers:,} subs | {avg_views:,.0f} avg views | {outlier_score}x | {ch_type}")
    return True


def main():
    print("=" * 65)
    print("  YouTube Niche Finder — LOCAL Data Collector (SQLite)")
    print("=" * 65)
    print(f"  Database: {DB_PATH}")
    print(f"  API Key : {API_KEY[:20]}..." if API_KEY else "  ⚠ No API key!")
    print()

    if not API_KEY:
        print("ERROR: YOUTUBE_API_KEY not set in .env")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    print("  ✓ Connected to SQLite database\n")

    with open("channel_ids.txt") as f:
        lines = [
            l.strip() for l in f
            if l.strip() and not l.startswith("#")
        ]

    print(f"  Processing {len(lines)} channels...\n")

    success, failed = 0, 0
    for line in lines:
        parts   = line.split(",")
        ch_id   = parts[0].strip()
        niche   = parts[1].strip() if len(parts) > 1 else "General"
        ch_type = parts[2].strip() if len(parts) > 2 else None
        try:
            if process_channel(conn, ch_id, niche, ch_type):
                success += 1
            else:
                failed += 1
        except Exception as e:
            print(f"    ✗ ERROR: {e}")
            failed += 1

    # Final count
    total_ch  = conn.execute('SELECT COUNT(*) FROM "Channel"').fetchone()[0]
    total_vid = conn.execute('SELECT COUNT(*) FROM "Video"').fetchone()[0]
    conn.close()

    print("\n" + "=" * 65)
    print(f"  Done!  Success: {success}  |  Failed: {failed}")
    print(f"  Database now has {total_ch} channels and {total_vid} videos")
    print("=" * 65)


if __name__ == "__main__":
    main()
