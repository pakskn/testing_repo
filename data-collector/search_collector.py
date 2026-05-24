"""
Search-based collector — finds real faceless channels by keyword
Filters: 5K to 500K subscribers, long_form content
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import uuid, requests, isodate
from db_helper import get_connection
from datetime import datetime, timezone
from dotenv import load_dotenv
import os

load_dotenv()
from api_key_manager import APIKeyManager, safe_api_call
km      = APIKeyManager()
DB_PATH = '../prisma/dev.db'

MIN_SUBS    = 5_000
MAX_SUBS    = 500_000
FOUND_LIMIT = 55   # collect 55 to have buffer after duplicates

SEARCH_QUERIES = [
    # ── HFy / Reddit Stories ─────────────────────────────────────────────────
    ("hfy stories reddit narrated animated",          "HFy Stories"),
    ("reddit stories narrated channel r/",            "Reddit Stories"),
    ("relationship reddit stories narrated",          "Reddit Stories"),
    ("aita reddit story narrated animated",           "Reddit Stories"),

    # ── Revenge / Drama Stories ──────────────────────────────────────────────
    ("revenge story animated narrated channel",       "Revenge Stories"),
    ("satisfying revenge story narrated",             "Revenge Stories"),
    ("pro revenge story narrated documentary",        "Revenge Stories"),

    # ── Crime Stories ────────────────────────────────────────────────────────
    ("criminal minds documentary narrated channel",   "Crime Stories"),
    ("crime story documentary narrated",              "Crime Stories"),
    ("real life crime story documentary",             "Crime Stories"),

    # ── Motivational Quotes / Stories ────────────────────────────────────────
    ("motivational quotes animated channel",          "Motivation"),
    ("motivational speech animated faceless",         "Motivation"),
    ("success mindset animated stories",              "Motivation"),

    # ── AI Restoration / AI Colorization ─────────────────────────────────────
    ("ai colorization old video restoration",         "AI Restoration"),
    ("ai restored historical footage channel",        "AI Restoration"),
    ("ai upscaling old photos restoration",           "AI Restoration"),
    ("ai image restoration colorization channel",     "AI Restoration"),

    # ── AI Survival / AI Future ───────────────────────────────────────────────
    ("ai survival scenario animated",                 "AI Survival"),
    ("ai future scenario documentary animated",       "AI Survival"),
    ("artificial intelligence world scenario",        "AI Survival"),

    # ── Survival / Wilderness ─────────────────────────────────────────────────
    ("survival skills wilderness documentary",        "Survival"),
    ("disaster survival documentary narrated",        "Survival"),
    ("extreme survival story narrated",               "Survival"),

    # ── Horror / Paranormal / Scary Stories ──────────────────────────────────
    ("horror scary stories narrated channel",         "Horror"),
    ("paranormal ghost stories narrated",             "Paranormal"),
    ("creepy scary stories animated narrated",        "Horror"),

    # ── Health / Medical Faceless ─────────────────────────────────────────────
    ("health body explained animated faceless",       "Health"),
    ("medical case documentary animated",             "Health"),
    ("nutrition health animated explained",           "Health"),

    # ── Military History / Wars ───────────────────────────────────────────────
    ("military history documentary narrated",         "History"),
    ("special forces documentary narrated",           "History"),
    ("ancient warfare battles documentary",           "History"),

    # ── Space & Cosmos ────────────────────────────────────────────────────────
    ("universe deep space documentary animated",      "Space"),
    ("black hole space explained animation",          "Space"),
    ("solar system planets documentary animated",     "Space"),

    # ── Conspiracy / Mystery ──────────────────────────────────────────────────
    ("conspiracy theory documentary animated",        "Conspiracy"),
    ("government secret documentary narrated",        "Conspiracy"),
    ("ancient mystery unsolved documentary",          "Conspiracy"),

    # ── Finance / Crypto ──────────────────────────────────────────────────────
    ("cryptocurrency bitcoin explained animated",     "Finance"),
    ("stock market crash explained documentary",      "Finance"),
    ("millionaire mindset animated stories",          "Finance"),

    # ── Nature / Wildlife ─────────────────────────────────────────────────────
    ("deep ocean sea creatures documentary",          "Nature"),
    ("amazon jungle wildlife documentary narrated",   "Wildlife"),
    ("predator prey nature documentary narrated",     "Wildlife"),

    # ── Exploration / Abandoned Places ────────────────────────────────────────
    ("abandoned places documentary narrated",         "Exploration"),
    ("urban exploration documentary channel",         "Exploration"),
    ("lost places mystery documentary narrated",      "Exploration"),

    # ── Self Improvement / Stoicism ───────────────────────────────────────────
    ("stoicism animated explained channel",           "Self Improvement"),
    ("stoic philosophy documentary animated",         "Self Improvement"),
    ("self improvement mindset animated channel",     "Self Improvement"),

    # ── Technology / Future ───────────────────────────────────────────────────
    ("future technology documentary animated",        "Technology"),
    ("ai robots future explained animation",          "Technology"),
]

def search_channels(query, max_results=10):
    """Search YouTube for channels by keyword"""
    url = "https://www.googleapis.com/youtube/v3/search"
    result = safe_api_call(
        lambda key: requests.get(url, params={
            "part": "snippet", "type": "channel",
            "q": query, "maxResults": max_results, "key": key,
        }).json(), km
    )
    if not result: return []
    return [item['id']['channelId'] for item in result.get('items', [])]

def get_channel_info(channel_id):
    result = safe_api_call(
        lambda key: requests.get("https://www.googleapis.com/youtube/v3/channels", params={
            "part": "snippet,statistics,contentDetails", "id": channel_id, "key": key,
        }).json(), km
    )
    if not result or not result.get('items'): return None
    return result['items'][0]

def get_top_videos(channel_id, max_results=5, uploads_playlist_id=None):
    """QUOTA-EFFICIENT: playlistItems = 1 unit, auto key rotation"""
    if not uploads_playlist_id:
        return []
    pl_res = safe_api_call(
        lambda key: requests.get("https://www.googleapis.com/youtube/v3/playlistItems", params={
            "part": "snippet", "playlistId": uploads_playlist_id,
            "maxResults": max_results * 3, "key": key,
        }).json(), km
    )
    if not pl_res: return []
    items = pl_res.get("items", [])
    if not items: return []
    vids = [item["snippet"]["resourceId"]["videoId"] for item in items
            if item["snippet"].get("resourceId", {}).get("kind") == "youtube#video"]
    if not vids: return []
    vr = safe_api_call(
        lambda key: requests.get("https://www.googleapis.com/youtube/v3/videos", params={
            "part": "snippet,statistics,contentDetails",
            "id": ",".join(vids[:50]), "key": key,
        }).json(), km
    )
    if not vr: return []
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
    return conn.execute('SELECT 1 FROM "Channel" WHERE "channelId"=?', (channel_id,)).fetchone() is not None

def save_channel(conn, data):
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("""
        INSERT INTO "Channel" (
            "id","channelId","channelName","channelHandle","thumbnailUrl",
            "subscribers","totalVideos","totalViews","channelType","niche",
            "daysSinceStart","avgViewsPerVideo","outlierScore","isMonetized",
            "isActive","sortOrder","createdAt","updatedAt"
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,true,0,?,?)
        ON CONFLICT ("channelId") DO UPDATE SET
            "channelName"=excluded."channelName","channelHandle"=excluded."channelHandle",
            "thumbnailUrl"=excluded."thumbnailUrl","subscribers"=excluded."subscribers",
            "totalVideos"=excluded."totalVideos","totalViews"=excluded."totalViews",
            "channelType"=excluded."channelType","niche"=excluded."niche",
            "avgViewsPerVideo"=excluded."avgViewsPerVideo","outlierScore"=excluded."outlierScore",
            "isMonetized"=excluded."isMonetized","updatedAt"=excluded."updatedAt"
    """, (str(uuid.uuid4()), data['channelId'], data['channelName'], data['channelHandle'],
          data['thumbnailUrl'], data['subscribers'], data['totalVideos'], data['totalViews'],
          data['channelType'], data['niche'], data['daysSinceStart'], data['avgViewsPerVideo'],
          data['outlierScore'], data['isMonetized'], now, now))
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

def main():
    print("=" * 65)
    print("  Faceless Channel Search Collector — 5K to 500K subs")
    print("=" * 65)

    conn = get_connection()

    found_total  = 0
    skipped_big  = 0
    skipped_small = 0
    skipped_dup  = 0
    seen_ids = set()

    for query, niche in SEARCH_QUERIES:
        if found_total >= FOUND_LIMIT:
            break
        print(f"\n  🔍 Searching: {query[:45]}...")
        channel_ids = search_channels(query, max_results=10)

        for ch_id in channel_ids:
            if found_total >= FOUND_LIMIT:
                break
            if ch_id in seen_ids:
                continue
            seen_ids.add(ch_id)

            if already_exists(conn, ch_id):
                skipped_dup += 1
                continue

            info = get_channel_info(ch_id)
            if not info:
                continue

            sn   = info.get('snippet', {})
            st   = info.get('statistics', {})
            name = sn.get('title', '')
            subs = int(st.get('subscriberCount', 0))
            vids = int(st.get('videoCount', 0))
            views= int(st.get('viewCount', 0))

            if subs < MIN_SUBS:
                skipped_small += 1
                continue
            if subs > MAX_SUBS:
                skipped_big += 1
                print(f"    ⏭ {name} — {subs:,} subs (too large)")
                continue

            pub = sn.get('publishedAt', '')
            days = (datetime.now(timezone.utc) - datetime.fromisoformat(pub.replace('Z','+00:00'))).days if pub else 0
            avg  = round(views / vids, 2) if vids > 0 else 0
            score= round(avg / subs, 2) if subs > 0 else 0
            thumb= sn.get('thumbnails', {}).get('default', {}).get('url', '')
            handle = sn.get('customUrl', '')

            save_channel(conn, {
                'channelId': ch_id, 'channelName': name,
                'channelHandle': handle, 'thumbnailUrl': thumb,
                'subscribers': subs, 'totalVideos': vids, 'totalViews': views,
                'channelType': 'long_form', 'niche': niche,
                'daysSinceStart': days, 'avgViewsPerVideo': avg,
                'outlierScore': score, 'isMonetized': subs >= 1000,
            })

            # Get uploads playlist ID from already-fetched info (no extra API call)
            uploads_pl = info.get('contentDetails', {}).get('relatedPlaylists', {}).get('uploads', '')

            # Get and save top 3 videos (QUOTA-EFFICIENT: 1 unit not 100)
            top_vids = get_top_videos(ch_id, max_results=5, uploads_playlist_id=uploads_pl)
            conn.execute('DELETE FROM "Video" WHERE "channelId"=?', (ch_id,))
            for v in top_vids[:3]:
                vs = v.get('statistics', {}); vsnip = v.get('snippet', {})
                vd = v.get('contentDetails', {})
                pub_v = vsnip.get('publishedAt', '')
                pub_dt = datetime.fromisoformat(pub_v.replace('Z','+00:00')) if pub_v else None
                save_video(conn, {
                    'videoId': v['id'], 'channelId': ch_id,
                    'title': vsnip.get('title', ''),
                    'thumbnailUrl': vsnip.get('thumbnails',{}).get('medium',{}).get('url',''),
                    'views': int(vs.get('viewCount', 0)),
                    'duration': format_duration(vd.get('duration','PT0S')),
                    'publishedAt': pub_dt,
                })

            icon = '🟢' if score >= 5 else ('🟡' if score >= 2 else '🔴')
            print(f"    {icon} SAVED: {name[:35]:35} | {subs:>8,} subs | {niche}")
            found_total += 1

    total_lf = conn.execute('SELECT COUNT(*) FROM "Channel" WHERE "channelType"=\'long_form\'').fetchone()[0]
    conn.close()

    print("\n" + "=" * 65)
    print(f"  New channels saved: {found_total}")
    print(f"  Skipped (too big): {skipped_big}  |  Too small: {skipped_small}  |  Already in DB: {skipped_dup}")
    print(f"  Total long_form in DB: {total_lf}")
    print("=" * 65)

if __name__ == "__main__":
    main()
