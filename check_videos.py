import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute('''
        SELECT title, "videoId", duration, views
        FROM "Video"
        WHERE "channelId" = (SELECT "channelId" FROM "Channel" WHERE "channelName" = 'Political Decrypt' LIMIT 1)
        ORDER BY views DESC
    ''')
    videos = cur.fetchall()
    
    print("Videos for Political Decrypt:")
    for v in videos:
        print(f"[{v[2]}] {v[1]} | {v[3]} views | {v[0]}")
            
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
