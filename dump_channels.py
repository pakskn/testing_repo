import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute('SELECT "channelName", "channelId" FROM "Channel" ORDER BY "channelName"')
    channels = cur.fetchall()
    
    for name, cid in channels:
        print(f"{name} ({cid})")
            
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
