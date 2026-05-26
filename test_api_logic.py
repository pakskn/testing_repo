import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

def durationToSeconds(dur):
    if not dur: return 0
    parts = list(map(int, dur.split(':')))
    if len(parts) == 3: return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if len(parts) == 2: return parts[0] * 60 + parts[1]
    return parts[0] if parts else 0

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    for name in ['StrikeTheory']:
        cur.execute('''
            SELECT "videoId", duration, "isShort"
            FROM "Video"
            WHERE "channelId" = (SELECT "channelId" FROM "Channel" WHERE "channelName" = %s LIMIT 1)
        ''', (name,))
        videos = cur.fetchall()
        
        # filter like API does
        noShorts = [v for v in videos if durationToSeconds(v[1]) > 60]
        longVids = [v for v in noShorts if durationToSeconds(v[1]) >= 180]
        
        final_videos = longVids if longVids else (noShorts if noShorts else videos)
        print(f"{name} final videos length: {len(final_videos)}")
            
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
