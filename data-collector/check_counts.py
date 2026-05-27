import os
import psycopg2
from dotenv import load_dotenv

def main():
    # If running locally, this uses the DATABASE_URL from .env
    # We will pass the DATABASE_URL of the local container DB: 'postgresql://niche_user:N1ch3_P_2026_Secure_Db@10.0.3.2:5432/niche_db'
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set")
        return

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute('SELECT "channelType", COUNT(*) FROM "Channel" GROUP BY "channelType"')
    print("Channels by type:")
    for row in cur.fetchall():
        print(f" - {row[0]}: {row[1]}")
        
    cur.execute('SELECT "isAi", COUNT(*) FROM "Channel" GROUP BY "isAi"')
    print("\nChannels by isAi:")
    for row in cur.fetchall():
        print(f" - {row[0]}: {row[1]}")
        
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
