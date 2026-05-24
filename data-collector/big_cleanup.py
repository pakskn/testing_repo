"""
Big Cleanup — 3 jobs:
1. sortOrder=-1 for channels with ALL videos > 3 years (was 4 years)
2. Aggressive shorts detection: ALL videos < 90s OR >= 70% < 120s
3. Print final stats
"""
import sqlite3

DB = "prisma/dev.db"
THREE_YEARS = "2023-05-21"   # today minus 3 years

conn = sqlite3.connect(DB)
conn.execute("PRAGMA busy_timeout=30000")
conn.execute("PRAGMA journal_mode=WAL")

def secs(dur):
    if not dur: return 9999
    p = dur.strip().split(":")
    try:
        if len(p)==3: return int(p[0])*3600+int(p[1])*60+int(p[2])
        if len(p)==2: return int(p[0])*60+int(p[1])
        return int(p[0])
    except: return 9999

# ── Job 1: Update sortOrder=-1 threshold from 4yr → 3yr ─────────────────────
print("Job 1: Updating inactive channel threshold to 3 years...")

# Reset previous -1 marks first (to re-evaluate with new threshold)
conn.execute("UPDATE Channel SET sortOrder=1 WHERE sortOrder=-1 AND thumbnailUrl IS NOT NULL AND thumbnailUrl != ''")
conn.execute("UPDATE Channel SET sortOrder=0 WHERE sortOrder=-1 AND (thumbnailUrl IS NULL OR thumbnailUrl = '')")
conn.commit()

channels_with_vids = conn.execute(
    'SELECT DISTINCT channelId FROM Video'
).fetchall()

inactive = []
for (ch_id,) in channels_with_vids:
    latest = conn.execute(
        'SELECT MAX(publishedAt) FROM Video WHERE channelId=?', (ch_id,)
    ).fetchone()[0]
    if latest and str(latest)[:10] < THREE_YEARS:
        inactive.append((ch_id,))

print(f"  Channels with ALL videos > 3 years old: {len(inactive)}")
for i in range(0, len(inactive), 500):
    conn.executemany('UPDATE Channel SET sortOrder=-1 WHERE channelId=?', inactive[i:i+500])
    conn.commit()
print(f"  sortOrder=-1 set for {len(inactive)} channels")

# ── Job 2: Aggressive shorts detection ───────────────────────────────────────
print("\nJob 2: Aggressive shorts detection...")

SHORTS_TITLE_KW = [
    "#shorts", "#short ", "#ytshorts", "#reels", "#tiktok",
    "#viral", "#foryou", "#fyp", "#foryoupage",
    "#longhair", "#skincare", "#makeup", "#grwm",
    "#beamng", "#healthtips", "#health tips",
    "#animation shorts", "#animatedshorts",
    "#motivation shorts", "#financeshorts",
    "shorts)", "(shorts", "| shorts",
]

all_lf_channels = conn.execute(
    'SELECT DISTINCT v.channelId FROM Video v '
    'JOIN Channel c ON v.channelId=c.channelId '
    'WHERE c.channelType="long_form"'
).fetchall()

to_move_shorts = []
for (ch_id,) in all_lf_channels:
    vids = conn.execute('SELECT title, duration FROM Video WHERE channelId=?', (ch_id,)).fetchall()
    if not vids: continue

    durations = [secs(d) for _, d in vids]
    valid = [s for s in durations if s < 9999]
    if not valid: continue

    avg_dur = sum(valid) / len(valid)
    under_90  = sum(1 for s in valid if s <= 90)
    under_120 = sum(1 for s in valid if s <= 120)
    under_180 = sum(1 for s in valid if s <= 180)

    # Rule 1: ALL videos <= 90s → definitely shorts
    if under_90 == len(valid):
        to_move_shorts.append((ch_id,))
        continue

    # Rule 2: >= 70% videos <= 120s → very likely shorts
    if under_120 / len(valid) >= 0.70 and avg_dur < 110:
        to_move_shorts.append((ch_id,))
        continue

    # Rule 3: ALL videos <= 180s + title has shorts-style keyword
    if under_180 == len(valid):
        for title, _ in vids:
            t = " " + (title or "").lower() + " "
            if any(kw in t for kw in SHORTS_TITLE_KW):
                to_move_shorts.append((ch_id,))
                break

print(f"  Shorts channels to move: {len(to_move_shorts)}")
for i in range(0, len(to_move_shorts), 500):
    conn.executemany('UPDATE Channel SET channelType="short_form" WHERE channelId=?', to_move_shorts[i:i+500])
    conn.commit()

# ── Job 3: Channel name/handle based shorts detection (no videos needed) ─────
print("\nJob 3: Channel name/handle shorts detection (all 1M channels)...")

NAME_SHORTS_KW = [
    "shorts channel", "shorts only", "short videos", "short video channel",
    "reels channel", "tiktok channel", "vertical videos",
    " shorts ", "#shorts", "ytshorts",
]

name_rows = conn.execute(
    'SELECT channelId, channelName, channelHandle FROM Channel '
    'WHERE channelType="long_form" AND isActive=1'
).fetchall()

name_shorts = []
for ch_id, name, handle in name_rows:
    t = " " + (name or "").lower() + " " + (handle or "").lower() + " "
    if any(kw in t for kw in NAME_SHORTS_KW):
        name_shorts.append((ch_id,))

print(f"  Name-based shorts: {len(name_shorts)}")
for i in range(0, len(name_shorts), 500):
    conn.executemany('UPDATE Channel SET channelType="short_form" WHERE channelId=?', name_shorts[i:i+500])
    conn.commit()

# ── Final Stats ───────────────────────────────────────────────────────────────
lf  = conn.execute('SELECT COUNT(*) FROM Channel WHERE channelType="long_form"').fetchone()[0]
sf  = conn.execute('SELECT COUNT(*) FROM Channel WHERE channelType="short_form"').fetchone()[0]
arc = conn.execute('SELECT COUNT(*) FROM Channel WHERE sortOrder=-1').fetchone()[0]
print(f"\n=== FINAL STATS ===")
print(f"long_form:   {lf:,}")
print(f"short_form:  {sf:,}")
print(f"archive(-1): {arc:,}")
conn.close()
print("DONE")
