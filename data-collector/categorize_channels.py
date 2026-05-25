"""
YouTube Niche Finder — Channel Categorization Script
======================================================
Categorizes channels as 'long' or 'short' based on their last 30 days of video uploads,
respecting the rules set by the user:
- No shorts in last 30 days -> 'long'
- No long videos in last 30 days -> 'short'
- >= 65% shorts in last 30 days -> 'short'
- Otherwise -> 'long'

Unifies both SQLite and PostgreSQL connection types dynamically using db_helper.
"""

import os
import sys
from datetime import datetime, timedelta
import db_helper

def categorize_channels():
    print("=" * 60)
    print("Channel Categorization Utility starting...")
    print("=" * 60)
    
    # 1. Connect to database
    db_url = os.getenv("DATABASE_URL")
    print(f"Connecting to database...")
    conn = db_helper.get_connection(db_url)
    cursor = conn.cursor()
    
    # 2. Define 30-day cutoff
    cutoff_date = datetime.now() - timedelta(days=30)
    cutoff_str = cutoff_date.strftime('%Y-%m-%d %H:%M:%S')
    print(f"Cutoff date for 30-day activity: {cutoff_str}")
    
    # 3. Fetch all videos uploaded in the last 30 days
    # Supports both SQLite and PostgreSQL
    print("Fetching active videos from last 30 days...")
    cursor.execute('SELECT "channelId", "isShort" FROM "Video" WHERE "publishedAt" >= ?', [cutoff_str])
    video_rows = cursor.fetchall()
    print(f"Loaded {len(video_rows):,} active videos.")
    
    # 4. Group videos by channelId in memory
    channel_video_stats = {}
    for ch_id, is_short in video_rows:
        # standard mapping for boolean fields in python (SQLite int / Postgres bool)
        is_short_bool = bool(is_short)
        
        if ch_id not in channel_video_stats:
            channel_video_stats[ch_id] = {'shorts': 0, 'longs': 0, 'total': 0}
            
        channel_video_stats[ch_id]['total'] += 1
        if is_short_bool:
            channel_video_stats[ch_id]['shorts'] += 1
        else:
            channel_video_stats[ch_id]['longs'] += 1
            
    # 5. Fetch all channel IDs from database
    print("Fetching channels from database...")
    cursor.execute('SELECT "channelId", "channelType", "channelName" FROM "Channel"')
    channels = cursor.fetchall()
    print(f"Loaded {len(channels):,} channels.")
    
    # 6. Apply rules and prepare updates
    updates = []
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    categorized_long = 0
    categorized_short = 0
    
    for ch_id, current_type, name in channels:
        stats = channel_video_stats.get(ch_id)
        
        # Categorization Rules:
        if not stats or stats['total'] == 0:
            # Rule 1: No activity in last 30 days -> default to 'long'
            new_type = 'long'
            shorts_ratio = 0.0
        else:
            total = stats['total']
            shorts = stats['shorts']
            longs = stats['longs']
            
            if shorts == 0:
                # Rule 1: No shorts in last 30 days -> 'long'
                new_type = 'long'
            elif longs == 0:
                # Rule 2: No longs in last 30 days -> 'short'
                new_type = 'short'
            elif (shorts / total) >= 0.65:
                # Rule 3: >= 65% shorts -> 'short'
                new_type = 'short'
            else:
                # Rule 4: Otherwise -> 'long' (Hybrid mostly long)
                new_type = 'long'
                
            shorts_ratio = (shorts / total) * 100.0
            
        if new_type == 'long':
            categorized_long += 1
        else:
            categorized_short += 1
            
        # Only append to updates if we actually need to write (or we update all for consistency)
        updates.append((new_type, shorts_ratio, now_str, ch_id))
        
    # 7. Execute bulk updates in batches of 1,000 for high performance
    print(f"\nPreparing to save updates: {categorized_long:,} Long, {categorized_short:,} Short...")
    
    batch_size = 1000
    for i in range(0, len(updates), batch_size):
        batch = updates[i:i+batch_size]
        # In python db_helper, we can execute many updates
        # To make it simple and fast, we loop inside transaction
        for new_type, ratio, now, ch_id in batch:
            cursor.execute(
                'UPDATE "Channel" SET "channelType" = ?, "shortsRatioLast30d" = ?, "lastCategorizedAt" = ? WHERE "channelId" = ?',
                [new_type, ratio, now, ch_id]
            )
        conn.commit()
        if (i + len(batch)) % 10000 == 0 or i + len(batch) == len(updates):
            print(f"   Processed {i + len(batch):,} / {len(updates):,} channels...")
            
    print("\nChannel categorization completed successfully!")
    print(f"   - Long Form channels: {categorized_long:,}")
    print(f"   - Short Form channels: {categorized_short:,}")
    print("=" * 60)

    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    categorize_channels()
