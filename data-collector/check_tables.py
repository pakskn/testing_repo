import psycopg2
import os
from dotenv import load_dotenv

def main():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    print(f"Connecting to: {db_url.split('@')[-1] if '@' in db_url else db_url}")
    
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # List tables
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
    tables = [row[0] for row in cur.fetchall()]
    print("\nTables found in Postgres:")
    for t in tables:
        print(f" - {t}")
        
    # For each table, describe columns
    for t in tables:
        if t in ['Channel', 'Video', 'channels', 'videos']:
            print(f"\nColumns in table '{t}':")
            cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{t}'")
            for col, dtype in cur.fetchall():
                print(f"   * {col} ({dtype})")
                
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
