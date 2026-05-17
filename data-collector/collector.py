import requests
import psycopg2
from datetime import datetime, timezone
import isodate
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("YOUTUBE_API_KEY")
DB_URL  = os.getenv("DATABASE_URL")


def get_channel_info(channel_id):
    url = "https://www.googleapis.com/youtube/v3/channels"
    params = {
        "part": "snippet,statistics,contentDetails",
        "id": channel_id,
        "key": API_KEY
    }
    r = requests.get(url, params=params).json()
    if not r.get("items"):
        return None
    return r["items"][0]


def get_top_videos(channel_id, max_results=8):
    search_url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part": "snippet",
        "channelId": channel_id,
        "order": "viewCount",
        "maxResults": max_results,
        "type": "video",
        "key": API_KEY
    }
    search_res = requests.get(search_url, params=params).json()
    items = search_res.get("items", [])
    if not items:
        return []

    video_ids = [item["id"]["videoId"] for item in items]
    video_url = "https://www.googleapis.com/youtube/v3/videos"
    params2 = {
        "part": "snippet,statistics,contentDetails",
        "id": ",".join(video_ids),
        "key": API_KEY
    }
    video_res = requests.get(video_url, params=params2).json()
    return video_res.get("items", [])


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


def save_channel(conn, data):
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO "Channel" (
            id, "channelId", "channelName", "channelHandle",
            "thumbnailUrl", subscribers, "totalVideos", "totalViews",
            "channelType", niche, "daysSinceStart", "avgViewsPerVideo",
            "outlierScore", "isMonetized", "createdAt", "updatedAt"
        ) VALUES (
            gen_random_uuid(), %(channelId)s, %(channelName)s, %(channelHandle)s,
            %(thumbnailUrl)s, %(subscribers)s, %(totalVideos)s, %(totalViews)s,
            %(channelType)s, %(niche)s, %(daysSinceStart)s, %(avgViewsPerVideo)s,
            %(outlierScore)s, %(isMonetized)s, NOW(), NOW()
        )
        ON CONFLICT ("channelId") DO UPDATE SET
            "channelName"       = EXCLUDED."channelName",
            subscribers         = EXCLUDED.subscribers,
            "totalVideos"       = EXCLUDED."totalVideos",
            "totalViews"        = EXCLUDED."totalViews",
            "avgViewsPerVideo"  = EXCLUDED."avgViewsPerVideo",
            "outlierScore"      = EXCLUDED."outlierScore",
            "isMonetized"       = EXCLUDED."isMonetized",
            "updatedAt"         = NOW()
    """, data)
    conn.commit()
    cur.close()


def save_video(conn, data):
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO "Video" (
            id, "videoId", "channelId", title,
            "thumbnailUrl", views, duration, "publishedAt"
        ) VALUES (
            gen_random_uuid(), %(videoId)s, %(channelId)s, %(title)s,
            %(thumbnailUrl)s, %(views)s, %(duration)s, %(publishedAt)s
        )
        ON CONFLICT ("videoId") DO UPDATE SET
            views    = EXCLUDED.views,
            title    = EXCLUDED.title
    """, data)
    conn.commit()
    cur.close()


def process_channel(conn, channel_id, niche, channel_type_override=None):
    print(f"Processing: {channel_id}")
    info = get_channel_info(channel_id)
    if not info:
        print(f"  Not found: {channel_id}")
        return

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
    videos        = get_top_videos(channel_id, max_results=8)

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

    for v in videos:
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

    print(f"  Saved: {name} | {subscribers:,} subs | {outlier_score}x outlier | type: {ch_type}")


def main():
    print("=" * 60)
    print("YouTube Niche Finder — Data Collector")
    print("=" * 60)

    conn = psycopg2.connect(DB_URL)
    print("Connected to database\n")

    with open("channel_ids.txt") as f:
        lines = [
            l.strip() for l in f
            if l.strip() and not l.startswith("#")
        ]

    print(f"Found {len(lines)} channels to process\n")

    success = 0
    failed  = 0
    for line in lines:
        parts   = line.split(",")
        ch_id   = parts[0].strip()
        niche   = parts[1].strip() if len(parts) > 1 else "General"
        ch_type = parts[2].strip() if len(parts) > 2 else None
        try:
            process_channel(conn, ch_id, niche, ch_type)
            success += 1
        except Exception as e:
            print(f"  ERROR processing {ch_id}: {e}")
            failed += 1

    conn.close()
    print("\n" + "=" * 60)
    print(f"Done! Success: {success} | Failed: {failed}")
    print("=" * 60)


if __name__ == "__main__":
    main()
