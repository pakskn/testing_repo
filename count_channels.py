import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute('SELECT COUNT(*) FROM "Channel"')
    count = cur.fetchone()[0]
    print(f"TOTAL CHANNELS IN DB: {count}")
            
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
