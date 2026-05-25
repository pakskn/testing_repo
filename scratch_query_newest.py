import sqlite3
import os
import urllib.request
import urllib.error

db_path = os.path.abspath('prisma/dev.db')
print(f"Checking database at: {db_path}")

channels_to_query = [
    "D. Edinboro", "Brie Louis", "CHASING SUCCESS", 
    "Nickie Perdomo", "Greater Bakersfield Ch...", "Abhi Concept"
]

try:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # We will search by matching start
    query = "SELECT channelId, channelName, thumbnailUrl FROM \"Channel\" WHERE " + " OR ".join([f"channelName LIKE '{c}%'" for c in channels_to_query])
    cur.execute(query)
    rows = cur.fetchall()
    
    print("\n--- QUERY RESULTS ---")
    for r in rows:
        url = r[2]
        print(f"ID: {r[0]} | Name: {r[1]} | Thumbnail: {url}")
        
        # Test HTTP request status for this URL
        try:
            req = urllib.request.Request(
                url, 
                method='GET',
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
            )
            with urllib.request.urlopen(req, timeout=3) as response:
                content = response.read()
                print(f"   GET Status: {response.getcode()} | Downloaded Length: {len(content)}")
        except urllib.error.HTTPError as e:
            print(f"   HTTP Error: {e.code} - {e.reason}")
        except Exception as e:
            print(f"   Exception: {e}")
            
    conn.close()
except Exception as e:
    print(f"Error: {e}")
