import sqlite3

DB = "prisma/dev.db"
conn = sqlite3.connect(DB)
conn.execute("PRAGMA busy_timeout=30000")

def secs(dur):
    if not dur: return 9999
    p = dur.strip().split(":")
    try:
        if len(p)==3: return int(p[0])*3600+int(p[1])*60+int(p[2])
        if len(p)==2: return int(p[0])*60+int(p[1])
        return int(p[0])
    except: return 9999

# Get all long_form channels that have videos
channels = conn.execute("""
    SELECT DISTINCT v.channelId FROM "Video" v
    JOIN "Channel" c ON v.channelId=c.channelId
    WHERE c.channelType="long_form"
""").fetchall()
print(f"long_form channels with videos: {len(channels)}")

to_move = []
for (ch_id,) in channels:
    vids = conn.execute('SELECT duration FROM "Video" WHERE channelId=?', (ch_id,)).fetchall()
    if not vids: continue
    durations = [secs(d[0]) for d in vids if secs(d[0]) < 9999]
    if not durations: continue
    # ALL videos <= 180s (3 min) → shorts channel
    if max(durations) <= 180:
        to_move.append((ch_id,))

print(f"Channels where ALL videos <= 3min (shorts): {len(to_move)}")

for i in range(0, len(to_move), 500):
    conn.executemany('UPDATE "Channel" SET channelType="short_form" WHERE channelId=?', to_move[i:i+500])
    conn.commit()

sf = conn.execute('SELECT COUNT(*) FROM "Channel" WHERE channelType="short_form"').fetchone()[0]
lf = conn.execute('SELECT COUNT(*) FROM "Channel" WHERE channelType="long_form"').fetchone()[0]
print(f"short_form: {sf:,}   long_form: {lf:,}")
conn.close()
print("DONE")
