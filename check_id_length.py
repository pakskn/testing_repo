import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute('''
        SELECT "videoId", LENGTH("videoId")
        FROM "Video"
        WHERE "channelId" = (SELECT "channelId" FROM "Channel" WHERE "channelName" = 'Forgotten Factories Canada' LIMIT 1)
    ''')
    videos = cur.fetchall()
    
    print("Forgotten Factories Canada video lengths:")
    for vid_id, length in videos:
        print(f"[{vid_id}] -> length: {length}")
            
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
