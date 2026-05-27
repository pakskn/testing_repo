"""
Daily Auto Collector — Niche Finder (Optimized & Smart Delta Sync)
=====================================
Roz chalao: 
1. Pehle existing channels ko delta sync ke sath batch refresh karta hai (70-80% cheaper)
2. Phir naye channels discover karta hai if target not met
Auto key rotation: jab 1 key ka quota khatam ho, 2nd pe shift
Diverse categories: Sports, True Crime, History, Documentary + 45 more

Usage:
    python -X utf8 daily_collector.py
"""
import sys, io, uuid, requests, isodate, os
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from api_key_manager import APIKeyManager, safe_api_call
from db_helper import get_connection

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
TARGET      = 100               # Target new/updated channels per run
MIN_SUBS    = 5_000
MAX_SUBS    = 500_000

# ── All Search Queries — 55 Categories ───────────────────────────────────────
SEARCH_QUERIES = [
    # ── Sports ──────────────────────────────────────────────────────────────
    ("sports documentary narrated faceless channel",             "Sports"),
    ("football soccer documentary animated narrated",            "Sports"),
    ("cricket football highlights documentary narrated",         "Sports"),
    ("sports history documentary voiceover channel",             "Sports"),
    ("extreme sports documentary narrated animated",             "Sports"),

    # ── True Crime / Crime ──────────────────────────────────────────────────
    ("true crime documentary narrated channel",                  "True Crime"),
    ("real crime case documentary narrated faceless",            "True Crime"),
    ("cold case documentary narrated animated",                  "True Crime"),
    ("criminal minds documentary narrated channel",              "Crime"),
    ("murder mystery documentary narrated voiceover",            "True Crime"),
    ("serial killer documentary narrated faceless",              "Crime"),
    ("crime investigation documentary narrated channel",         "Crime"),

    # ── History ─────────────────────────────────────────────────────────────
    ("history documentary animated narrated channel",            "History"),
    ("ancient history animated documentary faceless",            "History"),
    ("world history documentary narrated voiceover",             "History"),
    ("military history documentary narrated animated",           "History"),
    ("medieval history animated documentary channel",            "History"),
    ("historical events animated documentary narrated",          "History"),

    # ── Documentary ─────────────────────────────────────────────────────────
    ("documentary narrated faceless channel animated",           "Documentary"),
    ("dark documentary narrated animated channel",               "Documentary"),
    ("real life documentary narrated voiceover",                 "Documentary"),
    ("social experiment documentary narrated channel",           "Documentary"),
    ("unsolved documentary narrated animated",                   "Documentary"),

    # ── Horror / Paranormal ─────────────────────────────────────────────────
    ("horror documentary narrated animated channel",             "Horror"),
    ("paranormal documentary narrated faceless",                 "Paranormal"),
    ("scary true stories narrated animated",                     "Horror"),
    ("ghost stories documentary narrated channel",               "Paranormal"),
    ("creepy mystery documentary narrated",                      "Horror"),

    # ── Science / Space ─────────────────────────────────────────────────────
    ("science explained animated documentary",                   "Science"),
    ("space documentary animated narrated channel",              "Space"),
    ("astronomy universe documentary animated",                  "Space"),
    ("physics explained animated faceless channel",              "Science"),

    # ── Nature / Wildlife ───────────────────────────────────────────────────
    ("wildlife documentary narrated faceless channel",           "Wildlife"),
    ("nature documentary narrated animated",                     "Nature"),
    ("ocean sea creatures documentary narrated",                 "Nature"),
    ("animal wildlife documentary narrated channel",             "Wildlife"),

    # ── Finance / Business ──────────────────────────────────────────────────
    ("finance money explained animated documentary",             "Finance"),
    ("business documentary animated narrated",                   "Business"),
    ("stock market explained animated faceless",                 "Finance"),
    ("economics explained animated documentary",                 "Finance"),
    ("real estate investing explained animated",                 "Business"),

    # ── Motivation / Self Help ──────────────────────────────────────────────
    ("motivational stories animated narrated channel",           "Motivation"),
    ("success story animated faceless channel",                  "Motivation"),
    ("mindset documentary animated narrated",                    "Self Improvement"),
    ("stoicism animated explained faceless",                     "Self Improvement"),

    # ── AI / Technology ─────────────────────────────────────────────────────
    ("ai artificial intelligence documentary animated",          "AI"),
    ("technology future explained animated channel",             "Technology"),
    ("ai restoration colorization historical footage",           "AI Restoration"),
    ("machine learning ai explained animated",                   "Technology"),

    # ── Conspiracy / Mystery ────────────────────────────────────────────────
    ("conspiracy theory documentary animated narrated",          "Conspiracy"),
    ("ancient mystery unsolved documentary animated",            "Conspiracy"),
    ("government secret documentary narrated channel",           "Conspiracy"),
    ("lost civilization mystery documentary narrated",           "Conspiracy"),

    # ── Survival / Adventure ────────────────────────────────────────────────
    ("survival documentary narrated animated channel",           "Survival"),
    ("wilderness adventure documentary narrated",                "Survival"),
    ("disaster documentary narrated animated",                   "Survival"),

    # ── Health / Psychology ─────────────────────────────────────────────────
    ("health medical explained animated faceless",               "Health"),
    ("psychology facts documentary animated",                    "Psychology"),
    ("mental health explained animated channel",                 "Psychology"),
    ("nutrition diet facts animated documentary",                "Health"),

    # ── Reddit / Stories ────────────────────────────────────────────────────
    ("reddit stories narrated animated channel",                 "Reddit Stories"),
    ("hfy reddit narrated animated faceless",                    "HFy Stories"),
    ("revenge story narrated animated channel",                  "Revenge Stories"),
    ("relationship story narrated animated",                     "Reddit Stories"),
]

# ─────────────────────────────────────────────────────────────────────────────
def secs_iso(iso_d):
    try: return int(isodate.parse_duration(iso_d).total_seconds())
    except: return 0

def fmt_dur(iso_d):
    t = secs_iso(iso_d)
    m, s = divmod(t, 60); h, m = divmod(m, 60)
    return f'{h}:{m:02d}:{s:02d}' if h else f'{m}:{s:02d}'

def already_exists(conn, ch_id):
    return conn.execute('SELECT 1 FROM "Channel" WHERE "channelId"=?', (ch_id,)).fetchone() is not None

def save_channel(conn, data):
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("""
        INSERT INTO "Channel"(
            "id","channelId","channelName","channelHandle","thumbnailUrl",
            "subscribers","totalVideos","totalViews","channelType","niche",
            "daysSinceStart","avgViewsPerVideo","outlierScore","isMonetized",
            "isActive","sortOrder","createdAt","updatedAt"
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,true,0,?,?)
        ON CONFLICT("channelId") DO UPDATE SET
            "channelName"=excluded."channelName","thumbnailUrl"=excluded."thumbnailUrl",
            "subscribers"=excluded."subscribers","totalVideos"=excluded."totalVideos",
            "totalViews"=excluded."totalViews","avgViewsPerVideo"=excluded."avgViewsPerVideo",
            "outlierScore"=excluded."outlierScore","isMonetized"=excluded."isMonetized",
            "updatedAt"=excluded."updatedAt"
    """, (str(uuid.uuid4()), data['channelId'], data['channelName'], data['channelHandle'],
          data['thumbnailUrl'], data['subscribers'], data['totalVideos'], data['totalViews'],
          'long_form', data['niche'], data['daysSinceStart'], data['avgViewsPerVideo'],
          data['outlierScore'], data['isMonetized'], now, now))
    conn.commit()

def save_video(conn, data):
    pub = data['publishedAt'].isoformat() if data['publishedAt'] else None
    conn.execute("""
        INSERT INTO "Video"("id","videoId","channelId","title","thumbnailUrl","views","duration","publishedAt")
        VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT("videoId") DO UPDATE SET
            "views"=excluded."views","title"=excluded."title","thumbnailUrl"=excluded."thumbnailUrl"
    """, (str(uuid.uuid4()), data['videoId'], data['channelId'], data['title'],
          data['thumbnailUrl'], data['views'], data['duration'], pub))
    conn.commit()

# ── YouTube API calls ─────────────────────────────────────────────────────────
def search_channels(query, km, max_results=10):
    r = safe_api_call(lambda key: requests.get(
        'https://www.googleapis.com/youtube/v3/search',
        params={'part':'snippet','type':'channel','q':query,'maxResults':max_results,'key':key}
    ).json(), km)
    return [i['id']['channelId'] for i in (r or {}).get('items', [])]

def get_channels_batch(ch_ids, km):
    """
    Cost-effective batch call fetching stats of up to 50 channels at once.
    Costs ONLY 1 quota unit total!
    """
    if not ch_ids: return []
    r = safe_api_call(lambda key: requests.get(
        'https://www.googleapis.com/youtube/v3/channels',
        params={'part':'snippet,statistics,contentDetails','id':','.join(ch_ids),'key':key}
    ).json(), km)
    return (r or {}).get('items', [])

def get_top_videos(uploads_pl, km, max_results=5):
    if not uploads_pl: return []
    pl = safe_api_call(lambda key: requests.get(
        'https://www.googleapis.com/youtube/v3/playlistItems',
        params={'part':'snippet','playlistId':uploads_pl,'maxResults':max_results*3,'key':key}
    ).json(), km)
    if not pl: return []
    vids = [i['snippet']['resourceId']['videoId'] for i in pl.get('items',[])
            if i['snippet'].get('resourceId',{}).get('kind')=='youtube#video']
    if not vids: return []
    vr = safe_api_call(lambda key: requests.get(
        'https://www.googleapis.com/youtube/v3/videos',
        params={'part':'snippet,statistics,contentDetails','id':','.join(vids[:20]),'key':key}
    ).json(), km)
    if not vr: return []
    videos = vr.get('items', [])
    # Prefer long videos (>= 60 seconds)
    long_vids = [v for v in videos if secs_iso(v.get('contentDetails',{}).get('duration','PT0S')) >= 60]
    result = long_vids if long_vids else videos
    result.sort(key=lambda v: int(v.get('statistics',{}).get('viewCount',0)), reverse=True)
    return result[:max_results]

# ── Dynamic Caching & Delta Ingestion ──────────────────────────────────────────
def refresh_existing_channels(conn, km):
    """
    Fetches details of active channels older than 24 hours in batches of 50.
    Implements a smart Delta Video Bypass to skip unchanged playlist items.
    """
    print("\n  🔄 [Phase 1/2] Refreshing Existing Channels (Smart Delta Sync)...")
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    
    # Query channels needing refresh
    rows = conn.execute(
        'SELECT "channelId", "totalVideos", "channelName" FROM "Channel" WHERE "isActive" = true AND "updatedAt" < ?',
        (cutoff,)
    ).fetchall()

    if not rows:
        print("    ✅ All channels up to date (updated within last 24 hours).")
        return 0

    print(f"    Found {len(rows)} channels older than 24 hours.")
    
    # Map channelId -> old totalVideos for fast lookup
    old_totals = {r[0]: (r[1], r[2]) for r in rows}
    ch_ids = list(old_totals.keys())
    
    refreshed = 0
    delta_skipped = 0
    
    # Group into batches of 50 to optimize API cost (1 unit per 50 channels!)
    for i in range(0, len(ch_ids), 50):
        batch = ch_ids[i:i+50]
        items = get_channels_batch(batch, km)
        
        for info in items:
            ch_id = info.get('id')
            sn    = info.get('snippet', {})
            st    = info.get('statistics', {})
            cd    = info.get('contentDetails', {})
            
            name  = sn.get('title', '')
            subs  = int(st.get('subscriberCount', 0))
            vids  = int(st.get('videoCount', 0))
            views = int(st.get('viewCount', 0))
            
            # Retrieve old stats
            old_vids, old_name = old_totals.get(ch_id, (0, ''))
            
            # Check how many videos already exist in our local DB for this channel
            has_videos = conn.execute('SELECT COUNT(*) FROM "Video" WHERE "channelId"=?', (ch_id,)).fetchone()[0]
            
            # Smart Delta Bypass condition: totalVideos unchanged and we already have cached popular videos
            skip_video_sync = (vids == old_vids) and (has_videos >= 3)
            
            pub_str = sn.get('publishedAt', '')
            days_since = 0
            if pub_str:
                created = datetime.fromisoformat(pub_str.replace('Z','+00:00'))
                days_since = (datetime.now(timezone.utc) - created).days
                
            avg_views = round(views / vids, 2) if vids > 0 else 0
            outlier   = round(avg_views / subs, 2) if subs > 0 else 0
            thumb     = sn.get('thumbnails', {}).get('default', {}).get('url', '')
            handle    = sn.get('customUrl', '')
            uploads_pl= cd.get('relatedPlaylists', {}).get('uploads', '')
            
            now_str = datetime.now(timezone.utc).isoformat()
            
            # Update channel stats
            conn.execute("""
                UPDATE "Channel" SET
                    "channelName" = ?, "thumbnailUrl" = ?, "subscribers" = ?,
                    "totalVideos" = ?, "totalViews" = ?, "avgViewsPerVideo" = ?,
                    "outlierScore" = ?, "isMonetized" = ?, "daysSinceStart" = ?,
                    "channelHandle" = ?, "updatedAt" = ?
                WHERE "channelId" = ?
            """, (name, thumb, subs, vids, views, avg_views, outlier, subs >= 1000, days_since, handle, now_str, ch_id))
            conn.commit()
            
            if skip_video_sync:
                # DELTA SYNC BYPASS (CHEAPEST UPDATE!)
                print(f"    [Delta Sync] 🟢 Skipped video scan for: {name[:32]:32} (vids: {vids} unchanged)")
                delta_skipped += 1
            else:
                # Video counts changed or table lacks references → execute details fetch
                conn.execute('DELETE FROM "Video" WHERE "channelId"=?', (ch_id,))
                conn.commit()
                
                vid_saved = 0
                for v in get_top_videos(uploads_pl, km, max_results=5)[:3]:
                    vs = v.get('statistics',{}); vsnip = v.get('snippet',{}); vd = v.get('contentDetails',{})
                    pub_v = vsnip.get('publishedAt','')
                    pub_dt = datetime.fromisoformat(pub_v.replace('Z','+00:00')) if pub_v else None
                    save_video(conn, {
                        'videoId': v['id'], 'channelId': ch_id,
                        'title': vsnip.get('title',''),
                        'thumbnailUrl': vsnip.get('thumbnails',{}).get('medium',{}).get('url',''),
                        'views': int(vs.get('viewCount',0)),
                        'duration': fmt_dur(vd.get('duration','PT0S')),
                        'publishedAt': pub_dt,
                    })
                    vid_saved += 1
                
                print(f"    [Detail Sync] 🟡 Synced {vid_saved} videos for: {name[:32]:32} (videos count changed: {old_vids} ➔ {vids})")
            
            refreshed += 1
            
    print(f"  ✅ Refresh complete. Updated {refreshed} channels. Delta skipped video scans on {delta_skipped} channels.")
    return refreshed

# ─────────────────────────────────────────────────────────────────────────────
def main():
    start_time = datetime.now()
    print("=" * 70)
    print("  Niche Finder — Optimized Auto Collector (Smart Delta Ingestion)")
    print(f"  Date: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Max Discovery Target: {TARGET} channels | Subs: {MIN_SUBS:,}–{MAX_SUBS:,}")
    print("=" * 70)

    # Initialize API Key Manager
    km = APIKeyManager()
    km.print_status()
    print()

    # Check DB and get connection wrapper
    try:
        conn = get_connection()
    except Exception as e:
        print(f"  ❌ Database connection failed: {e}")
        return
        
    # Phase 1: Smart batch refresh on existing data (Costs close to 0 quota units!)
    try:
        refresh_existing_channels(conn, km)
    except Exception as e:
        print(f"  ⚠️ Existing channels refresh failed: {e}")

    # Phase 2: Search discovery for new niche channels (only up to TARGET)
    print("\n  🔍 [Phase 2/2] Discovering New Channels...")
    seen    = set()
    saved   = 0
    dup     = big = small = 0

    for query, niche in SEARCH_QUERIES:
        if saved >= TARGET:
            break

        print(f"\n  🔍 [{saved}/{TARGET}] {niche}: {query[:45]}...")
        ch_ids = search_channels(query, km, max_results=10)

        for ch_id in ch_ids:
            if saved >= TARGET: break
            if ch_id in seen: continue
            seen.add(ch_id)

            if already_exists(conn, ch_id):
                dup += 1; continue

            info = get_top_videos # wait, get_channel_info
            info = get_channel_info(ch_id, km)
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

            pub_str = sn.get('publishedAt', '')
            if pub_str:
                created    = datetime.fromisoformat(pub_str.replace('Z','+00:00'))
                days_since = (datetime.now(timezone.utc) - created).days
            else:
                days_since = 0

            avg_views = round(views / vids, 2) if vids > 0 else 0
            outlier   = round(avg_views / subs, 2) if subs > 0 else 0
            thumb     = sn.get('thumbnails', {}).get('default', {}).get('url', '')
            handle    = sn.get('customUrl', '')
            uploads_pl= cd.get('relatedPlaylists', {}).get('uploads', '')

            save_channel(conn, {
                'channelId': ch_id, 'channelName': name, 'channelHandle': handle,
                'thumbnailUrl': thumb, 'subscribers': subs, 'totalVideos': vids,
                'totalViews': views, 'niche': niche, 'daysSinceStart': days_since,
                'avgViewsPerVideo': avg_views, 'outlierScore': outlier,
                'isMonetized': subs >= 1000,
            })

            # Fetch + save top 3 long videos
            conn.execute('DELETE FROM "Video" WHERE "channelId"=?', (ch_id,))
            conn.commit()
            
            vid_saved = 0
            for v in get_top_videos(uploads_pl, km, max_results=5)[:3]:
                vs = v.get('statistics',{}); vsnip = v.get('snippet',{}); vd = v.get('contentDetails',{})
                pub_v = vsnip.get('publishedAt','')
                pub_dt = datetime.fromisoformat(pub_v.replace('Z','+00:00')) if pub_v else None
                save_video(conn, {
                    'videoId': v['id'], 'channelId': ch_id,
                    'title': vsnip.get('title',''),
                    'thumbnailUrl': vsnip.get('thumbnails',{}).get('medium',{}).get('url',''),
                    'views': int(vs.get('viewCount',0)),
                    'duration': fmt_dur(vd.get('duration','PT0S')),
                    'publishedAt': pub_dt,
                })
                vid_saved += 1

            icon = '🟢' if outlier >= 5 else ('🟡' if outlier >= 2 else '🔴')
            print(f"    {icon} {name[:38]:38} | {subs:>7,} subs | {outlier:.2f}x | {vid_saved}v")
            saved += 1

    # Final stats
    elapsed = (datetime.now() - start_time).seconds
    total_lf  = conn.execute('SELECT COUNT(*) FROM "Channel" WHERE "channelType"=\'long_form\' AND "isActive"=true').fetchone()[0]
    total_all = conn.execute('SELECT COUNT(*) FROM "Channel" WHERE "isActive"=true').fetchone()[0]
    total_vid = conn.execute('SELECT COUNT(*) FROM "Video"').fetchone()[0]
    conn.close()

    print("\n" + "=" * 70)
    print(f"  ✅ RUN COMPLETE in {elapsed}s")
    print(f"  Saved:     {saved} new channels")
    print(f"  Skipped:   {dup} dup | {big} too big | {small} too small")
    print(f"  DB Total:  {total_all} channels ({total_lf} long form) | {total_vid} videos")
    print("=" * 70)
    km.print_status()

if __name__ == "__main__":
    main()
