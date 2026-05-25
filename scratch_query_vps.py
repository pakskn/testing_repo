import os
import psycopg2
from dotenv import load_dotenv

def main():
    db_url = 'postgresql://niche_user:N1ch3_P_2026_Secure_Db@10.0.3.2:5432/niche_db'
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute('SELECT "channelType", COUNT(*) FROM "Channel" GROUP BY "channelType"')
    print("Channels by type:")
    for row in cur.fetchall():
        print(f" - {row[0]}: {row[1]}")
        
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
