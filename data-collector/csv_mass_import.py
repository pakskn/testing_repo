"""
CSV Mass Import — 1M+ YouTube Channels
Zero API calls — sab data CSV se
Outlier score = mean_views_last_30 / subscribers
Niche = keywords + description se auto-detect
"""
import sys, io, csv, sqlite3, uuid, os
from datetime import datetime, timezone

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

CSV_PATH = r'D:\Waqasalee\Niche R Tool\youtube_channels_1M_clean.csv'
DB_PATH  = '../prisma/dev.db'
BATCH    = 5_000   # rows per SQLite commit

# ── Niche detection from keywords/description ────────────────────────────────
NICHE_MAP = {
    'Horror':      ['horror','scary','paranormal','ghost','haunted','creepy','dark'],
    'True Crime':  ['true crime','murder','killer','criminal','detective','homicide'],
    'Crime':       ['crime','police','law','justice','court','felony','robbery'],
    'History':     ['history','historical','ancient','war','medieval','civilization','empire'],
    'Science':     ['science','physics','chemistry','biology','experiment','lab'],
    'Space':       ['space','nasa','astronomy','universe','planet','galaxy','cosmos'],
    'Finance':     ['finance','money','invest','stock','bitcoin','crypto','trading','wealth'],
    'Business':    ['business','entrepreneur','startup','marketing','ecommerce','brand'],
    'Motivation':  ['motivation','mindset','success','inspire','goal','positive'],
    'Psychology':  ['psychology','mental health','behavior','brain','therapy','emotion'],
    'Self Improvement':['self improvement','habit','discipline','growth','productivity'],
    'Health':      ['health','medical','doctor','nutrition','diet','wellness','medicine'],
    'Fitness':     ['fitness','workout','gym','exercise','bodybuilding','yoga'],
    'Gaming':      ['gaming','game','minecraft','fortnite','gameplay','esports','gamer'],
    'Sports':      ['sports','football','cricket','basketball','soccer','tennis','nba','nfl'],
    'Technology':  ['technology','tech','software','coding','programming','developer'],
    'AI':          ['artificial intelligence','machine learning','ai ','deep learning','chatgpt'],
    'Education':   ['education','learn','tutorial','course','teaching','school','study'],
    'Cooking':     ['cooking','food','recipe','chef','kitchen','restaurant','baking'],
    'Travel':      ['travel','tour','adventure','explore','destination','vlog','backpack'],
    'Nature':      ['nature','wildlife','animal','forest','ocean','environment','ecology'],
    'Wildlife':    ['wildlife','safari','bird','marine','reptile','mammal'],
    'Conspiracy':  ['conspiracy','secret','government','exposed','illuminati'],
    'Paranormal':  ['paranormal','ufo','alien','supernatural','mystery','occult'],
    'Music':       ['music','song','singer','album','artist','concert','band'],
    'Comedy':      ['comedy','funny','humor','laugh','meme','prank','stand up'],
    'Animation':   ['animation','animated','cartoon','anime','2d','3d','pixar'],
    'Survival':    ['survival','wilderness','prepper','bushcraft','disaster','apocalypse'],
    'DIY':         ['diy','craft','handmade','woodwork','repair','build','make'],
    'Motivation':  ['motivational','quotes','inspire','mindset','winner'],
    'HFy Stories': ['hfy','humanity','reddit story','narrator','reddit reads'],
    'True Crime':  ['true crime','cold case','missing person','unsolved','serial killer'],
}

def detect_niche(keywords_str, desc_str=''):
    text = (keywords_str + ' ' + desc_str[:300]).lower()
    for niche, keywords in NICHE_MAP.items():
        for kw in keywords:
            if kw in text:
                return niche
    return 'General'

def parse_days(date_str):
    if not date_str: return 0
    try:
        d = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return max(0, (datetime.now(timezone.utc) - d.replace(tzinfo=timezone.utc) if d.tzinfo is None else datetime.now(timezone.utc) - d).days)
    except: return 0

def safe_float(v, default=0.0):
    try: return float(v) if v else default
    except: return default

def safe_int(v, default=0):
    try: return int(float(v)) if v else default
    except: return default

# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("=" * 70)
    print("  CSV Mass Import — 1M+ YouTube Channels (ZERO API calls)")
    print("=" * 70)

    if not os.path.exists(CSV_PATH):
        print(f"  ❌ CSV not found: {CSV_PATH}"); return

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")

    # Existing channels (to skip)
    existing = set(r[0] for r in conn.execute('SELECT "channelId" FROM "Channel"').fetchall())
    print(f"  Existing in DB: {len(existing):,} channels (will skip)")

    total = new = skipped = errors = 0
    batch = []
    now = datetime.now(timezone.utc).isoformat()
    start = datetime.now()

    print(f"\n  Reading CSV... (836 MB — takes ~2 min)")

    with open(CSV_PATH, encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1

            ch_id = row.get('channel_id', '').strip()
            if not ch_id or ch_id in existing:
                skipped += 1
                if total % 100_000 == 0:
                    elapsed = (datetime.now() - start).seconds
                    print(f"  [{total:>9,}] New: {new:,} | Skip: {skipped:,} | {elapsed}s")
                continue

            subs   = safe_int(row.get('subscriber_count'))
            tvids  = safe_int(row.get('total_videos'))
            tviews = safe_int(row.get('total_views'))
            mean_v = safe_float(row.get('mean_views_last_30_videos'))
            vpw    = safe_float(row.get('videos_per_week'))
            days   = parse_days(row.get('join_date', ''))

            # Outlier score from CSV data (no API needed!)
            outlier = round(mean_v / subs, 2) if subs > 0 else 0.0

            # Avg views per video (from total)
            avg_views = round(tviews / tvids, 2) if tvids > 0 else mean_v

            # Niche from keywords + description
            kw   = row.get('keywords', '') or ''
            desc = row.get('description', '') or ''
            niche = detect_niche(kw, desc)

            # Channel name
            name   = row.get('channel_name', '').strip() or 'Unknown'
            handle = row.get('channel_link', '').strip().lstrip('/')
            thumb  = row.get('avatar', '').strip()

            batch.append((
                str(uuid.uuid4()), ch_id, name, handle, thumb or None,
                subs, tvids, tviews,
                'long_form',   # default type
                niche, days, avg_views, outlier,
                1 if subs >= 1000 else 0,
                1, 0, now, now
            ))
            new += 1

            if len(batch) >= BATCH:
                conn.executemany("""
                    INSERT OR IGNORE INTO "Channel"(
                        "id","channelId","channelName","channelHandle","thumbnailUrl",
                        "subscribers","totalVideos","totalViews","channelType","niche",
                        "daysSinceStart","avgViewsPerVideo","outlierScore","isMonetized",
                        "isActive","sortOrder","createdAt","updatedAt"
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, batch)
                conn.commit()
                batch.clear()

            if total % 100_000 == 0:
                elapsed = (datetime.now() - start).seconds
                print(f"  [{total:>9,}] New: {new:,} | Skip: {skipped:,} | {elapsed}s elapsed")

    # Final batch
    if batch:
        conn.executemany("""
            INSERT OR IGNORE INTO "Channel"(
                "id","channelId","channelName","channelHandle","thumbnailUrl",
                "subscribers","totalVideos","totalViews","channelType","niche",
                "daysSinceStart","avgViewsPerVideo","outlierScore","isMonetized",
                "isActive","sortOrder","createdAt","updatedAt"
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, batch)
        conn.commit()

    total_in_db = conn.execute('SELECT COUNT(*) FROM "Channel"').fetchone()[0]
    lf = conn.execute('SELECT COUNT(*) FROM "Channel" WHERE channelType="long_form"').fetchone()[0]
    niches = conn.execute('SELECT niche, COUNT(*) as c FROM "Channel" GROUP BY niche ORDER BY c DESC LIMIT 10').fetchall()
    db_size = os.path.getsize(DB_PATH) / (1024*1024)
    conn.close()

    elapsed_total = (datetime.now() - start).seconds
    print("\n" + "=" * 70)
    print(f"  ✅ IMPORT COMPLETE in {elapsed_total}s")
    print(f"  CSV rows:        {total:>10,}")
    print(f"  New imported:    {new:>10,}")
    print(f"  Skipped (dup):   {skipped:>10,}")
    print(f"  Total in DB:     {total_in_db:>10,}")
    print(f"  DB size:         {db_size:.1f} MB")
    print(f"\n  Top Niches:")
    for n, c in niches:
        print(f"    {n:<20} {c:>8,}")
    print("=" * 70)
    print(f"\n  📊 QUOTA NEEDED to refresh all {total_in_db:,} channels:")
    print(f"     channels.list:     {total_in_db:,} units  (1/channel)")
    print(f"     playlistItems:     {total_in_db:,} units  (1/channel)")
    print(f"     videos.list:       {total_in_db // 20:,} units  (1 per 20 videos batch)")
    total_units = total_in_db * 3
    print(f"     TOTAL needed:      {total_units:,} units")
    print(f"     With 2 keys:       {total_units // 20_000:,} days")
    print(f"     With 10 keys:      {total_units // 100_000:,} days")

if __name__ == "__main__":
    main()
