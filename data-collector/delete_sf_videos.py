import sqlite3
conn = sqlite3.connect("../prisma/dev.db")
conn.execute("PRAGMA busy_timeout=30000")

sf_vids = conn.execute("""
    SELECT COUNT(*) FROM "Video" v
    JOIN "Channel" c ON v.channelId=c.channelId
    WHERE c.channelType='short_form'
""").fetchone()[0]
print(f"Short form videos to delete: {sf_vids}")

conn.execute("""
    DELETE FROM "Video" WHERE channelId IN (
        SELECT channelId FROM "Channel" WHERE channelType='short_form'
    )
""")
conn.commit()

total_v = conn.execute('SELECT COUNT(*) FROM "Video"').fetchone()[0]
total_ch = conn.execute('SELECT COUNT(DISTINCT channelId) FROM "Video"').fetchone()[0]
lf_v = conn.execute("""
    SELECT COUNT(*) FROM "Video" v
    JOIN "Channel" c ON v.channelId=c.channelId
    WHERE c.channelType='long_form'
""").fetchone()[0]
print(f"Remaining: {total_v} total videos, {total_ch} channels")
print(f"Long form videos: {lf_v}")
conn.close()
print("Done")
