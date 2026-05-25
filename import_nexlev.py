import json
import os
import uuid
from datetime import datetime, timezone

def calculate_outlier_score(avg_views, subscribers):
    if not subscribers or subscribers == 0:
        return 0.0
    return round(avg_views / subscribers, 2)

def import_to_db(connection, is_postgres=False):
    cur = connection.cursor()
    with open('combined_channels.json', 'r', encoding='utf-8') as f:
        channels = json.load(f)
    
    now = datetime.now(timezone.utc).isoformat()
    now_str = now.replace('T', ' ') if is_postgres else now
    
    for ch in channels:
        ch_id = ch['channelId']
        name = ch.get('title', 'Unknown')
        thumbnail = ch.get('channelAvatar', '')
        subs = ch.get('subscribers', 0)
        vids = ch.get('numOfUploads', 0)
        views = ch.get('totalViews', 0)
        niche = ch.get('categories', ['General'])[0] if ch.get('categories') else 'General'
        days_since = ch.get('daysSinceStart', 0)
        avg_views = ch.get('avgViewPerVideo', 0)
        monetized = 1 if ch.get('isMonetized', False) else 0
        faceless = 1 if ch.get('isFaceless', False) else 0
        score = calculate_outlier_score(avg_views, subs)
        monthly_views = ch.get('avgMonthlyViews', 0)
        
        # Hardcode long_form as requested
        ch_type = 'long'
        
        if is_postgres:
            monetized = bool(monetized)
            faceless = bool(faceless)
        
        query = """
            INSERT INTO "Channel" (
                "id", "channelId", "channelName", "thumbnailUrl", "subscribers",
                "totalVideos", "totalViews", "channelType", "niche", "daysSinceStart",
                "avgViewsPerVideo", "outlierScore", "isMonetized", "isFaceless", "monthlyViews",
                "createdAt", "updatedAt"
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT ("channelId") DO UPDATE SET
                "channelName" = EXCLUDED."channelName",
                "thumbnailUrl" = EXCLUDED."thumbnailUrl",
                "subscribers" = EXCLUDED."subscribers",
                "totalVideos" = EXCLUDED."totalVideos",
                "totalViews" = EXCLUDED."totalViews",
                "niche" = EXCLUDED."niche",
                "daysSinceStart" = EXCLUDED."daysSinceStart",
                "avgViewsPerVideo" = EXCLUDED."avgViewsPerVideo",
                "outlierScore" = EXCLUDED."outlierScore",
                "isMonetized" = EXCLUDED."isMonetized",
                "isFaceless" = EXCLUDED."isFaceless",
                "monthlyViews" = EXCLUDED."monthlyViews",
                "updatedAt" = EXCLUDED."updatedAt"
        """
        if not is_postgres:
            query = query.replace('%s', '?')
            query = query.replace('ON CONFLICT ("channelId") DO UPDATE SET', '''ON CONFLICT ("channelId") DO UPDATE SET
                "channelName" = excluded."channelName",
                "thumbnailUrl" = excluded."thumbnailUrl",
                "subscribers" = excluded."subscribers",
                "totalVideos" = excluded."totalVideos",
                "totalViews" = excluded."totalViews",
                "niche" = excluded."niche",
                "daysSinceStart" = excluded."daysSinceStart",
                "avgViewsPerVideo" = excluded."avgViewsPerVideo",
                "outlierScore" = excluded."outlierScore",
                "isMonetized" = excluded."isMonetized",
                "isFaceless" = excluded."isFaceless",
                "monthlyViews" = excluded."monthlyViews",
                "updatedAt" = excluded."updatedAt"''')
            # sqlite query has to strictly use excluded. instead of EXCLUDED. and remove the previous ON CONFLICT
            # Wait, easier to just manually do it:
            query = """
            INSERT INTO "Channel" (
                "id", "channelId", "channelName", "thumbnailUrl", "subscribers",
                "totalVideos", "totalViews", "channelType", "niche", "daysSinceStart",
                "avgViewsPerVideo", "outlierScore", "isMonetized", "isFaceless",
                "createdAt", "updatedAt"
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT ("channelId") DO UPDATE SET
                "channelName" = excluded."channelName",
                "thumbnailUrl" = excluded."thumbnailUrl",
                "subscribers" = excluded."subscribers",
                "totalVideos" = excluded."totalVideos",
                "totalViews" = excluded."totalViews",
                "niche" = excluded."niche",
                "daysSinceStart" = excluded."daysSinceStart",
                "avgViewsPerVideo" = excluded."avgViewsPerVideo",
                "outlierScore" = excluded."outlierScore",
                "isMonetized" = excluded."isMonetized",
                "isFaceless" = excluded."isFaceless",
                "updatedAt" = excluded."updatedAt"
            """
            
        if is_postgres:
            cur.execute(query, (
                str(uuid.uuid4()), ch_id, name, thumbnail, subs, vids, views, ch_type, niche,
                days_since, avg_views, score, monetized, faceless, monthly_views, now_str, now_str
            ))
        else:
            cur.execute(query, (
                str(uuid.uuid4()), ch_id, name, thumbnail, subs, vids, views, ch_type, niche,
                days_since, avg_views, score, monetized, faceless, now_str, now_str
            ))
        
    connection.commit()
    cur.close()
    print(f"Successfully imported {len(channels)} channels into {'PostgreSQL' if is_postgres else 'SQLite'}.")

def main():
    db_url = os.environ.get('DATABASE_URL')
    
    if db_url and db_url.startswith('postgres'):
        import psycopg2
        print(f"Connecting to PostgreSQL...")
        conn = psycopg2.connect(db_url)
        import_to_db(conn, is_postgres=True)
        conn.close()
    else:
        import sqlite3
        print(f"Connecting to local SQLite...")
        conn = sqlite3.connect('prisma/dev.db')
        import_to_db(conn, is_postgres=False)
        conn.close()

if __name__ == '__main__':
    main()
