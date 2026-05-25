import sqlite3
import urllib.request
import urllib.error
import concurrent.futures
import time
import sys
import threading

# Ensure stdout uses UTF-8 and is fully unbuffered
sys.stdout.reconfigure(encoding='utf-8')

DB_PATH = "prisma/dev.db"
MAX_WORKERS = 120
TIMEOUT = 3.0
BATCH_SIZE = 500

print("Connecting to SQLite database...", flush=True)
conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA busy_timeout=30000")
conn.execute("PRAGMA journal_mode=WAL")

# Query all channels that we need to verify
print("Querying active channels...", flush=True)
channels = conn.execute('SELECT channelId, thumbnailUrl FROM "Channel"').fetchall()
total_channels = len(channels)
print(f"Loaded {total_channels:,} channels for verification.", flush=True)

broken_ids = []
broken_lock = threading.Lock()
processed_count = 0
progress_lock = threading.Lock()

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def check_channel(ch_id, url):
    global processed_count
    
    # Progress indicator
    with progress_lock:
        processed_count += 1
        if processed_count % 1000 == 0 or processed_count == total_channels:
            print(f"🔄 Progress: {processed_count:,} / {total_channels:,} checked ({processed_count/total_channels*100:.1f}%) | Broken found: {len(broken_ids):,}", flush=True)

    if not url:
        with broken_lock:
            broken_ids.append(ch_id)
        return

    # Retries for timeouts or transient network glitches
    retries = 3
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                method='HEAD',
                headers=headers
            )
            with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
                if response.getcode() == 200:
                    return # Valid and active avatar!
                else:
                    with broken_lock:
                        broken_ids.append(ch_id)
                    return
        except urllib.error.HTTPError as e:
            # 400, 403, 404, 410 mean broken
            if e.code in [400, 403, 404, 410]:
                with broken_lock:
                    broken_ids.append(ch_id)
                return
            # Server errors (500, 502, 503, 504), wait and retry
            time.sleep(0.3)
        except Exception:
            # Socket errors, connection timeouts, dns errors
            if attempt == retries - 1:
                with broken_lock:
                    broken_ids.append(ch_id)
                return
            time.sleep(0.3)

print(f"\n🚀 Starting high-reliability concurrent scanning with {MAX_WORKERS} workers...", flush=True)
start_time = time.time()

with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
    futures = [executor.submit(check_channel, row[0], row[1]) for row in channels]
    concurrent.futures.wait(futures)

elapsed_time = time.time() - start_time
print(f"\n✅ Scan completed in {elapsed_time:.1f} seconds.", flush=True)
print(f"Total checked: {total_channels:,}", flush=True)
print(f"Total broken channels found: {len(broken_ids):,} ({len(broken_ids)/total_channels*100:.1f}%)", flush=True)

if not broken_ids:
    print("🎉 No broken avatars found in the database. Everything is clean!", flush=True)
    conn.close()
    sys.exit(0)

# Deleting the broken channels from SQLite database
print(f"\n🧹 Preparing to delete {len(broken_ids):,} broken channels from database...", flush=True)

# Get database size before
db_size_before = conn.execute("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()").fetchone()[0]
print(f"DB size before: {db_size_before / 1_048_576:.1f} MB", flush=True)

# Delete in transaction chunks of 500
total_deleted_vids = 0
total_deleted_chans = 0

for i in range(0, len(broken_ids), BATCH_SIZE):
    batch = broken_ids[i:i+BATCH_SIZE]
    placeholders = ",".join(["?"] * len(batch))
    
    # Delete associated videos first (respect Foreign Key constraint)
    v_cursor = conn.execute(f'DELETE FROM "Video" WHERE channelId IN ({placeholders})', batch)
    total_deleted_vids += v_cursor.rowcount
    
    # Delete channels
    c_cursor = conn.execute(f'DELETE FROM "Channel" WHERE channelId IN ({placeholders})', batch)
    total_deleted_chans += c_cursor.rowcount
    
    conn.commit()
    
    if total_deleted_chans % 5000 == 0 or i + BATCH_SIZE >= len(broken_ids):
        print(f"   Deleted {total_deleted_chans:,} / {len(broken_ids):,} channels (and {total_deleted_vids:,} associated videos)...", flush=True)

# Compact database
print("\n📦 Running SQLite VACUUM to compact database and reclaim disk space...", flush=True)
conn.execute("VACUUM")
conn.commit()

db_size_after = conn.execute("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()").fetchone()[0]
remaining_channels = conn.execute('SELECT COUNT(*) FROM "Channel"').fetchone()[0]

print(f"\n✨ DATABASE PURGE COMPLETE!", flush=True)
print(f"Remaining active channels: {remaining_channels:,}", flush=True)
print(f"Total videos deleted:       {total_deleted_vids:,}", flush=True)
print(f"DB size after vacuum:       {db_size_after / 1_048_576:.1f} MB", flush=True)
print(f"Disk space saved:           {(db_size_before - db_size_after) / 1_048_576:.1f} MB", flush=True)

conn.close()
print("DONE", flush=True)
