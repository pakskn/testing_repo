"""
Detect and move Shorts channels from long_form → short_form.

A channel is SHORT FORM if:
  - Its videos are 9:16 format (portrait/vertical) AND < 3 minutes

Since aspect ratio isn't stored, we use reliable proxies:
  HIGH CONFIDENCE (9:16):
    1. Title contains #shorts / #short / #ytshorts / #reels / #tiktok
    2. Duration <= 62 seconds (old YouTube Shorts limit was 60s)
    3. Title contains common shorts indicators (POV, GRWM, etc.)

  CHANNEL rule: if >= 60% of fetched videos are shorts → move to short_form
"""
import sqlite3, sys, io, re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
DB_PATH = '../prisma/dev.db'

SHORTS_TITLE_KW = [
    '#shorts', '#short ', '#ytshorts', '#reels', '#tiktok',
    '#viral', '#trending', '#foryou', '#fyp', '#foryoupage',
    '#longhair', '#skincare', '#makeup', '#ootd', '#grwm',
    '#pov ', '(pov)', 'weight loss struggles', '#dubai', '#travel',
    '#beamng', '#gaming shorts', '#shortsvideo', '#shortvideo',
    '#minivlog', '#vlog shorts', '#daily shorts',
]

def parse_secs(dur):
    """'H:MM:SS' or 'M:SS' → total seconds"""
    if not dur: return 9999
    parts = dur.strip().split(':')
    try:
        if len(parts) == 3: return int(parts[0])*3600 + int(parts[1])*60 + int(parts[2])
        if len(parts) == 2: return int(parts[0])*60   + int(parts[1])
        return int(parts[0])
    except: return 9999

def is_short_video(title, duration):
    secs = parse_secs(duration)
    if secs > 180:          # > 3 min → NEVER a short
        return False
    if secs <= 62:           # ≤ 62s → almost certainly a short (old YT limit was 60s)
        return True
    # 63–180s: needs a tag or keyword to confirm it's 9:16
    t = (' ' + (title or '').lower() + ' ')
    return any(kw in t for kw in SHORTS_TITLE_KW)

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA busy_timeout=30000')

    # Only process long_form channels that have videos in DB
    channels = conn.execute('''
        SELECT DISTINCT c.channelId, c.channelName
        FROM Channel c
        WHERE c.channelType = 'long_form'
          AND c.isActive = 1
          AND EXISTS (SELECT 1 FROM Video v WHERE v.channelId = c.channelId)
    ''').fetchall()

    print(f'Long form channels WITH videos: {len(channels):,}')

    to_move = []
    checked = 0

    for ch_id, ch_name in channels:
        videos = conn.execute(
            'SELECT title, duration FROM Video WHERE channelId=?', (ch_id,)
        ).fetchall()

        if not videos:
            continue

        short_count = sum(1 for title, dur in videos if is_short_video(title, dur))
        total       = len(videos)
        ratio       = short_count / total

        # Move if >= 60% of videos are shorts
        if ratio >= 0.6:
            to_move.append((ch_id,))
            checked += 1

    print(f'Channels to move → short_form: {len(to_move):,}')

    if to_move:
        for i in range(0, len(to_move), 500):
            conn.executemany(
                'UPDATE Channel SET channelType="short_form" WHERE channelId=?',
                to_move[i:i+500]
            )
            conn.commit()

    # Stats
    lf = conn.execute('SELECT COUNT(*) FROM Channel WHERE channelType="long_form"').fetchone()[0]
    sf = conn.execute('SELECT COUNT(*) FROM Channel WHERE channelType="short_form"').fetchone()[0]
    print(f'After update — long_form: {lf:,}  short_form: {sf:,}')
    conn.close()
    print('DONE')

if __name__ == '__main__':
    main()
