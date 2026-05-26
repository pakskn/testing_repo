import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute('''
        SELECT "isShort", COUNT(*)
        FROM "Video"
        GROUP BY "isShort"
    ''')
    data = cur.fetchall()
    
    print("isShort counts:")
    for is_short, count in data:
        print(f"isShort={is_short}: {count} videos")
            
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
