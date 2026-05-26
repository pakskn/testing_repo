import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    for name in ['StrikeTheory', 'Forgotten Factories Canada', 'NextMindset', 'World Enigma']:
        cur.execute('''
            SELECT "videoId", "thumbnailUrl", duration
            FROM "Video"
            WHERE "channelId" = (SELECT "channelId" FROM "Channel" WHERE "channelName" = %s LIMIT 1)
        ''', (name,))
        videos = cur.fetchall()
        print(f"\n{name} ({len(videos)} videos in DB):")
        for v in videos:
            print(f"[{v[0]}] duration: {v[2]} | url: {v[1]}")
            
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
