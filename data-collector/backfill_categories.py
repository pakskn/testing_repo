"""
Category Backfill — 3 jobs in one run:
  1. Mark isKids=1  for channels with kids-related keywords in name/handle
  2. Mark isNews=1  for channels with news/TV keywords in name/handle
  3. Fix channelType: long_form channels whose fetched videos are >70% shorts → short_form

Usage: python backfill_categories.py
"""
import sqlite3, sys, io, re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
DB_PATH = '../prisma/dev.db'

# ── Keyword lists ─────────────────────────────────────────────────────────────

KIDS_KEYWORDS = [
    'kids', 'children', 'child', 'baby', 'babies', 'nursery', 'toddler',
    'preschool', 'kindergarten', 'junior', 'tots', 'lullaby', 'lullabies',
    'cocomelon', 'peppa', 'paw patrol', 'bluey', 'sesame', 'barney',
    'nickelodeon', 'disney junior', 'cartoon network kids', 'baby shark',
    'rhymes', 'abc kids', 'little ones', 'tiny', 'kidz', 'kiddie',
    'super simple', 'bounce patrol', 'little baby', 'mini', 'storytime',
    'playtime', 'learn with', 'learning for kids', 'education for kids',
    'fun for kids', 'songs for kids', 'nursery rhymes',
]

NEWS_KEYWORDS = [
    'news', 'breaking', 'reporter', 'journalism', 'press', 'media',
    'bbc', 'cnn', 'nbc', 'abc news', 'cbs', 'fox news', 'msnbc', 'cnbc',
    'pbs', 'sky news', 'al jazeera', 'reuters', 'associated press',
    'the guardian', 'washington post', 'new york times', 'daily mail',
    'times of india', 'ndtv', 'zee news', 'aaj tak', 'india tv',
    'dawn news', 'geo news', 'ary news', 'dunya news', 'express news',
    'samaa', 'hum news', 'channel 24', 'capital tv', '92 news',
    'bbc urdu', 'voice of america', 'voa', 'dw news', 'france 24',
    'euronews', 'al arabiya', 'press tv', 'rt news', 'one america',
    'newsmax', 'epoch times', 'breitbart', 'daily wire',
    'tv channel', 'official channel', 'official tv', 'live tv',
    'television', ' tv ', 'tvn', 'tbn', 'ctv', 'ntv', 'atv',
]

def matches(text: str, keywords: list) -> bool:
    t = (' ' + text.lower() + ' ')
    return any(kw in t for kw in keywords)

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")

    # ── Job 1: Mark isKids ────────────────────────────────────────────────────
    print("Job 1: Detecting Kids channels...")
    channels = conn.execute(
        'SELECT channelId, channelName, channelHandle FROM "Channel" WHERE isActive=1'
    ).fetchall()

    kids_ids, news_ids = [], []
    for ch_id, name, handle in channels:
        text = f"{name or ''} {handle or ''}"
        if matches(text, KIDS_KEYWORDS):
            kids_ids.append(ch_id)
        if matches(text, NEWS_KEYWORDS):
            news_ids.append(ch_id)

    if kids_ids:
        conn.executemany('UPDATE "Channel" SET isKids=1 WHERE channelId=?',
                         [(cid,) for cid in kids_ids])
    if news_ids:
        conn.executemany('UPDATE "Channel" SET isNews=1 WHERE channelId=?',
                         [(cid,) for cid in news_ids])

    print(f"  isKids=1 set for: {len(kids_ids):,} channels")
    print(f"  isNews=1 set for: {len(news_ids):,} channels")

    # ── Job 2: Fix Shorts in Long Form ────────────────────────────────────────
    print("\nJob 2: Fixing Shorts channels tagged as long_form...")

    # Channels tagged long_form that have videos fetched
    lf_with_vids = conn.execute('''
        SELECT c.channelId
        FROM "Channel" c
        WHERE c.channelType = 'long_form' AND c.isActive = 1
          AND EXISTS (SELECT 1 FROM "Video" v WHERE v.channelId = c.channelId)
    ''').fetchall()

    fixed = 0
    for (ch_id,) in lf_with_vids:
        vids = conn.execute(
            'SELECT duration FROM "Video" WHERE channelId=?', (ch_id,)
        ).fetchall()
        if not vids:
            continue

        def dur_secs(d):
            if not d: return 999
            p = d.split(':')
            try:
                if len(p) == 3: return int(p[0])*3600 + int(p[1])*60 + int(p[2])
                if len(p) == 2: return int(p[0])*60 + int(p[1])
            except: return 999
            return 999

        shorts_count = sum(1 for (d,) in vids if dur_secs(d) <= 60)
        if len(vids) > 0 and shorts_count / len(vids) >= 0.7:
            conn.execute(
                'UPDATE "Channel" SET channelType="short_form" WHERE channelId=?',
                (ch_id,)
            )
            fixed += 1

    print(f"  Channels moved long_form → short_form: {fixed}")

    conn.commit()
    conn.close()

    print("\n=== Done ===")
    print(f"  Kids channels:  {len(kids_ids):,}")
    print(f"  News channels:  {len(news_ids):,}")
    print(f"  Shorts fixed:   {fixed}")
    print("\nNext: run  npx prisma db push  to apply schema changes, then restart the app.")

if __name__ == "__main__":
    main()
