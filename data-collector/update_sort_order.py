"""
One-time backfill: Set sortOrder=1 for channels with thumbnails.
Run once after fetch_videos_bulk.py to make thumbnailed channels appear first in UI.

Usage: python update_sort_order.py
"""
import sqlite3, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DB_PATH = '../prisma/dev.db'

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")

    # Count before
    total     = conn.execute('SELECT COUNT(*) FROM "Channel"').fetchone()[0]
    has_thumb = conn.execute('SELECT COUNT(*) FROM "Channel" WHERE thumbnailUrl IS NOT NULL AND thumbnailUrl != ""').fetchone()[0]

    print(f"Total channels:       {total:,}")
    print(f"With thumbnails:      {has_thumb:,}")
    print(f"Without thumbnails:   {total - has_thumb:,}")
    print("\nUpdating sortOrder...")

    # Set sortOrder=1 for channels with thumbnails
    r1 = conn.execute('''
        UPDATE "Channel"
        SET sortOrder = 1
        WHERE thumbnailUrl IS NOT NULL AND thumbnailUrl != ''
    ''')

    # Set sortOrder=0 for channels without thumbnails
    r2 = conn.execute('''
        UPDATE "Channel"
        SET sortOrder = 0
        WHERE thumbnailUrl IS NULL OR thumbnailUrl = ''
    ''')

    conn.commit()
    conn.close()

    print(f"  sortOrder=1 set for: {r1.rowcount:,} channels (with thumbnails)")
    print(f"  sortOrder=0 set for: {r2.rowcount:,} channels (without thumbnails)")
    print("\nDone. Channels with thumbnails will now appear first in the UI.")

if __name__ == "__main__":
    main()
