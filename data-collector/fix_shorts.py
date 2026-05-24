import sqlite3

DB = "prisma/dev.db"
conn = sqlite3.connect(DB)
conn.execute("PRAGMA busy_timeout=30000")

SHORTS_KW = [
    "#shorts", "#short ", "#ytshorts", "#reels", "#tiktok",
    "#viral", "#foryou", "#fyp", "#foryoupage",
    "#longhair", "#skincare", "#makeup", "#grwm",
    "#beamng", "#shortsvideo", "#shortvideo",
    "weight loss struggles", "#dubai vlog",
]

def secs(dur):
    if not dur: return 9999
    p = dur.strip().split(":")
    try:
        if len(p) == 3: return int(p[0])*3600 + int(p[1])*60 + int(p[2])
        if len(p) == 2: return int(p[0])*60 + int(p[1])
        return int(p[0])
    except: return 9999

def is_short(title, dur):
    s = secs(dur)
    if s > 180: return False        # > 3 min = never a short
    if s <= 62: return True         # <= 62s = almost certainly a short
    t = " " + (title or "").lower() + " "
    return any(kw in t for kw in SHORTS_KW)

# Get all long_form channels that have videos in DB
channels = conn.execute(
    'SELECT DISTINCT c.channelId FROM "Channel" c '
    'WHERE c.channelType="long_form" AND c.isActive=1 '
    'AND EXISTS(SELECT 1 FROM "Video" v WHERE v.channelId=c.channelId)'
).fetchall()
print(f"long_form channels with videos: {len(channels)}")

to_move = []
for (ch_id,) in channels:
    vids = conn.execute(
        'SELECT title, duration FROM "Video" WHERE channelId=?', (ch_id,)
    ).fetchall()
    if not vids: continue
    short_count = sum(1 for t, d in vids if is_short(t, d))
    if short_count / len(vids) >= 0.6:
        to_move.append((ch_id,))

print(f"Channels to move → short_form: {len(to_move)}")

for i in range(0, len(to_move), 500):
    conn.executemany(
        'UPDATE "Channel" SET channelType="short_form" WHERE channelId=?',
        to_move[i:i+500]
    )
    conn.commit()

lf = conn.execute('SELECT COUNT(*) FROM "Channel" WHERE channelType="long_form"').fetchone()[0]
sf = conn.execute('SELECT COUNT(*) FROM "Channel" WHERE channelType="short_form"').fetchone()[0]
print(f"long_form: {lf:,}   short_form: {sf:,}")
conn.close()
print("DONE")
