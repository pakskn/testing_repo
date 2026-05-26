import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute('''
        SELECT "channelName", "channelType"
        FROM "Channel"
        WHERE "channelName" IN ('StrikeTheory', 'NextMindset', 'Forgotten Factories Canada', 'Travel Smarter')
    ''')
    channels = cur.fetchall()
    
    print("Channel Types:")
    for name, c_type in channels:
        print(f"{name}: {c_type}")
            
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
