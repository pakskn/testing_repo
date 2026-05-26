import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute('''
        SELECT "channelId", COUNT(*)
        FROM "Channel"
        GROUP BY "channelId"
        HAVING COUNT(*) > 1
    ''')
    dupes = cur.fetchall()
    
    if len(dupes) == 0:
        print("NO DUPLICATE CHANNEL IDs FOUND IN DATABASE.")
    else:
        for ch_id, count in dupes:
            print(f"DUPLICATE FOUND: {ch_id} (Count: {count})")
            
    cur.execute('''
        SELECT "channelName", COUNT(*)
        FROM "Channel"
        GROUP BY "channelName"
        HAVING COUNT(*) > 1
    ''')
    name_dupes = cur.fetchall()
    if len(name_dupes) == 0:
        print("NO DUPLICATE CHANNEL NAMES FOUND.")
    else:
        for name, count in name_dupes:
            print(f"DUPLICATE NAME FOUND: {name} (Count: {count})")
            
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
