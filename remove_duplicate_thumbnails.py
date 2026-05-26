import os
import psycopg2
import requests
from io import BytesIO
from PIL import Image
import imagehash
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

def main():
    print("Connecting to database...")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute('SELECT "channelId", "channelName" FROM "Channel"')
    channels = cur.fetchall()

    total_deleted = 0

    for ch_id, ch_name in channels:
        print(f"Checking {ch_name}...")
        cur.execute('''
            SELECT id, "videoId", "thumbnailUrl", views, title
            FROM "Video"
            WHERE "channelId" = %s
            ORDER BY views DESC
        ''', (ch_id,))
        videos = cur.fetchall()

        seen_hashes = {}
        to_delete = []

        for vid_db_id, vid_id, thumb_url, views, title in videos:
            if not thumb_url:
                continue

            try:
                # Download image
                response = requests.get(thumb_url, timeout=5)
                if response.status_code == 200:
                    img = Image.open(BytesIO(response.content))
                    
                    # Some thumbnails might have black bars, let's crop slightly to center to be safe or just use standard hash
                    # A perceptual hash (phash) is highly robust to slight changes (like text overlay)
                    img_hash = str(imagehash.phash(img))
                    
                    # We will allow a tiny bit of difference (hamming distance)
                    # For simplicity, let's check if the exact phash exists or is extremely close
                    is_duplicate = False
                    for seen_h, seen_id in seen_hashes.items():
                        # Calculate hamming distance
                        dist = imagehash.hex_to_hash(img_hash) - imagehash.hex_to_hash(seen_h)
                        # If distance is very small (e.g., < 10), they are basically the same image
                        if dist <= 12:
                            is_duplicate = True
                            print(f"  -> DUPLICATE FOUND in {ch_name}!")
                            print(f"     Keeping:   (Hash: {seen_h})")
                            print(f"     Deleting: {title} (Hash: {img_hash}, Dist: {dist})")
                            break
                    
                    if is_duplicate:
                        to_delete.append(vid_db_id)
                    else:
                        seen_hashes[img_hash] = vid_db_id

            except Exception as e:
                print(f"  -> Failed to process thumbnail for {vid_id}: {e}")

        # Delete the duplicates
        for d_id in to_delete:
            cur.execute('DELETE FROM "Video" WHERE id = %s', (d_id,))
            total_deleted += 1
            
        if to_delete:
            conn.commit()

    print(f"\nFINISHED! Total visually duplicate videos deleted: {total_deleted}")
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
