import sqlite3

conn = sqlite3.connect("../prisma/dev.db")
conn.execute("PRAGMA busy_timeout=30000")
conn.execute("PRAGMA journal_mode=WAL")

# Count before
total   = conn.execute('SELECT COUNT(*) FROM "Channel"').fetchone()[0]
no_thumb = conn.execute('SELECT COUNT(*) FROM "Channel" WHERE thumbnailUrl IS NULL OR thumbnailUrl = ""').fetchone()[0]
with_thumb = total - no_thumb

print(f"Total channels:      {total:,}")
print(f"Without thumbnail:   {no_thumb:,}")
print(f"With thumbnail:      {with_thumb:,}")
print(f"Will be deleted:     {no_thumb:,}")

db_size_before = conn.execute("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()").fetchone()[0]
print(f"\nDB size before: {db_size_before / 1_048_576:.1f} MB")

# Delete videos of no-thumbnail channels first (FK constraint)
vid_del = conn.execute("""
    DELETE FROM "Video" WHERE channelId IN (
        SELECT channelId FROM "Channel"
        WHERE thumbnailUrl IS NULL OR thumbnailUrl = ''
    )
""")
print(f"Videos deleted: {vid_del.rowcount:,}")

# Delete the channels
ch_del = conn.execute('DELETE FROM "Channel" WHERE thumbnailUrl IS NULL OR thumbnailUrl = ""')
conn.commit()
print(f"Channels deleted: {ch_del.rowcount:,}")

# VACUUM to reclaim space
print("\nRunning VACUUM to reclaim disk space...")
conn.execute("VACUUM")
conn.commit()

remaining = conn.execute('SELECT COUNT(*) FROM "Channel"').fetchone()[0]
db_size_after = conn.execute("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()").fetchone()[0]
print(f"\nRemaining channels: {remaining:,}")
print(f"DB size after:  {db_size_after / 1_048_576:.1f} MB")
print(f"Space saved:    {(db_size_before - db_size_after) / 1_048_576:.1f} MB")
conn.close()
print("DONE")
