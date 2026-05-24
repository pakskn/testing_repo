"""
Keep ONLY the ~290,597 Long Form channels that pass the UI filter.
Delete everything else + VACUUM to reclaim disk space.
"""
import sqlite3, time

conn = sqlite3.connect("../prisma/dev.db")
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA busy_timeout=60000")

# ── Count what we have ─────────────────────────────────────────────────────
total = conn.execute('SELECT COUNT(*) FROM "Channel"').fetchone()[0]
to_keep = conn.execute("""
    SELECT COUNT(*) FROM "Channel"
    WHERE channelType = 'long_form'
      AND isActive   = 1
      AND (niche NOT IN ('Music','Comedy','Animation') OR niche IS NULL)
      AND isKids        = 0
      AND isNews        = 0
      AND isEntertainment = 0
      AND isFaceless    = 1
      AND sortOrder    >= 0
""").fetchone()[0]
to_delete = total - to_keep

db_before = conn.execute("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()").fetchone()[0]
vids_before = conn.execute('SELECT COUNT(*) FROM "Video"').fetchone()[0]

print(f"Total channels now:  {total:,}")
print(f"Channels to KEEP:    {to_keep:,}")
print(f"Channels to DELETE:  {to_delete:,}")
print(f"Videos now:          {vids_before:,}")
print(f"DB size now:         {db_before/1_048_576:.1f} MB")
print()

# ── Step 1: Delete Videos for channels NOT in keep list ───────────────────
print("Step 1: Deleting videos of removed channels...")
t0 = time.time()
conn.execute("""
    DELETE FROM "Video" WHERE channelId NOT IN (
        SELECT channelId FROM "Channel"
        WHERE channelType = 'long_form'
          AND isActive    = 1
          AND (niche NOT IN ('Music','Comedy','Animation') OR niche IS NULL)
          AND isKids        = 0
          AND isNews        = 0
          AND isEntertainment = 0
          AND isFaceless    = 1
          AND sortOrder    >= 0
    )
""")
conn.commit()
vids_after = conn.execute('SELECT COUNT(*) FROM "Video"').fetchone()[0]
print(f"  Videos remaining: {vids_after:,}  (deleted {vids_before - vids_after:,}) [{time.time()-t0:.1f}s]")

# ── Step 2: Delete channels NOT in keep list ──────────────────────────────
print("Step 2: Deleting channels...")
t0 = time.time()
conn.execute("""
    DELETE FROM "Channel" WHERE channelId NOT IN (
        SELECT channelId FROM "Channel"
        WHERE channelType = 'long_form'
          AND isActive    = 1
          AND (niche NOT IN ('Music','Comedy','Animation') OR niche IS NULL)
          AND isKids        = 0
          AND isNews        = 0
          AND isEntertainment = 0
          AND isFaceless    = 1
          AND sortOrder    >= 0
    )
""")
conn.commit()
ch_after = conn.execute('SELECT COUNT(*) FROM "Channel"').fetchone()[0]
print(f"  Channels remaining: {ch_after:,}  (deleted {total - ch_after:,}) [{time.time()-t0:.1f}s]")

# ── Step 3: VACUUM to reclaim disk ─────────────────────────────────────────
print("Step 3: VACUUM (reclaiming disk space, may take a minute)...")
t0 = time.time()
conn.execute("VACUUM")
conn.commit()
db_after = conn.execute("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()").fetchone()[0]
print(f"  Done in {time.time()-t0:.1f}s")

print()
print("=" * 50)
print(f"Channels: {total:,} → {ch_after:,}")
print(f"Videos:   {vids_before:,} → {vids_after:,}")
print(f"DB size:  {db_before/1_048_576:.1f} MB → {db_after/1_048_576:.1f} MB")
print(f"Saved:    {(db_before - db_after)/1_048_576:.1f} MB")
print("=" * 50)
conn.close()
print("DONE")
