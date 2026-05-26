import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute('''
        SELECT "videoId", "thumbnailUrl"
        FROM "Video"
        WHERE "channelId" = (SELECT "channelId" FROM "Channel" WHERE "channelName" = 'Forgotten Factories Canada' LIMIT 1)
    ''')
    videos = cur.fetchall()
    
    print("Forgotten Factories Canada videos:")
    for vid_id, thumb_url in videos:
        print(f"[{vid_id}] -> {thumb_url}")
            
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
