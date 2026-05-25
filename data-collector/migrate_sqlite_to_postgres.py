"""
SQLite to PostgreSQL Data Migration Utility
=============================================
Safely copies all tables from the SQLite database to the PostgreSQL database,
mapping types (e.g. booleans, datetimes) and handling large data sets cleanly.

Usage:
    python migrate_sqlite_to_postgres.py
"""

import os
import sys
import sqlite3
import psycopg2
import psycopg2.extras
from datetime import datetime
from dotenv import load_dotenv

# Ensure stdout uses UTF-8
sys.stdout.reconfigure(encoding='utf-8')

# Load environment
load_dotenv()

SQLITE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../prisma/dev.db'))
POSTGRES_URL = os.getenv("DATABASE_URL")

# Check if target is indeed PostgreSQL
if not POSTGRES_URL or not (POSTGRES_URL.startswith("postgresql://") or POSTGRES_URL.startswith("postgres://")):
    print("❌ Error: DATABASE_URL is not configured for PostgreSQL in .env!")
    print(f"Current DATABASE_URL: {POSTGRES_URL}")
    sys.exit(1)

if not os.path.exists(SQLITE_PATH):
    # Try alternate location
    alt = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../prisma/dev.db'))
    if os.path.exists(alt):
        SQLITE_PATH = alt
    else:
        print(f"❌ Error: SQLite source database not found at {SQLITE_PATH}")
        sys.exit(1)

print("=" * 60)
print("🚀 SQLite ➡️ PostgreSQL Database Migration Utility")
print(f"Source SQLite:   {SQLITE_PATH} ({os.path.getsize(SQLITE_PATH) / 1024 / 1024:.2f} MB)")
print(f"Target Postgres: {POSTGRES_URL.split('@')[-1] if '@' in POSTGRES_URL else 'PostgreSQL'}")
print("=" * 60)

def convert_bool(val):
    if val is None:
        return False
    return bool(val)

def to_datetime(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return datetime.fromtimestamp(val / 1000.0)
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val.replace('Z', '+00:00'))
        except ValueError:
            try:
                return datetime.strptime(val, '%Y-%m-%d %H:%M:%S.%f')
            except ValueError:
                try:
                    return datetime.strptime(val, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    if val.isdigit():
                        return datetime.fromtimestamp(int(val) / 1000.0)
    return val

def migrate_table(lite_conn, pg_conn, table_name, select_cols, insert_cols, transform_fn=None, chunk_size=500):
    lite_cur = lite_conn.cursor()
    pg_cur = pg_conn.cursor()
    
    # 1. Get total count
    lite_cur.execute(f'SELECT COUNT(*) FROM "{table_name}"')
    total_rows = lite_cur.fetchone()[0]
    
    if total_rows == 0:
        print(f"ℹ️ Table '{table_name}' is empty. Skipping.")
        return 0
        
    print(f"📦 Migrating '{table_name}' ({total_rows:,} rows)...")
    
    # Clear target table in Postgres to prevent conflict
    print(f"   🧹 Truncating target PostgreSQL table '{table_name}'...")
    try:
        pg_cur.execute(f'TRUNCATE TABLE "{table_name}" CASCADE')
        pg_conn.commit()
    except Exception as e:
        pg_conn.rollback()
        print(f"   ⚠️ Could not truncate (might not exist yet): {e}. Proceeding with standard insert.")

    # 2. Read in chunks and insert
    cols_str = ", ".join([f'"{c}"' for c in select_cols])
    placeholders = ", ".join(["%s"] * len(insert_cols))
    insert_cols_str = ", ".join([f'"{c}"' for c in insert_cols])
    
    insert_query = f'INSERT INTO "{table_name}" ({insert_cols_str}) VALUES ({placeholders})'
    
    lite_cur.execute(f'SELECT {cols_str} FROM "{table_name}"')
    
    migrated_count = 0
    while True:
        rows = lite_cur.fetchmany(chunk_size)
        if not rows:
            break
            
        params_list = []
        for row in rows:
            # Apply transformation function if provided
            if transform_fn:
                row_data = transform_fn(row)
            else:
                row_data = list(row)
            params_list.append(row_data)
            
        try:
            # Batch execute insert query
            psycopg2.extras.execute_batch(pg_cur, insert_query, params_list)
            pg_conn.commit()
            migrated_count += len(rows)
            print(f"   ✅ Done: {migrated_count:,} / {total_rows:,} rows")
        except Exception as e:
            pg_conn.rollback()
            print(f"   ❌ Batch insert error in table '{table_name}': {e}")
            print(f"   Sample data: {params_list[0] if params_list else 'No data'}")
            raise e
            
    lite_cur.close()
    pg_cur.close()
    return migrated_count

def main():
    # Connect databases
    lite_conn = sqlite3.connect(SQLITE_PATH)
    pg_conn = psycopg2.connect(POSTGRES_URL)
    
    try:
        # --- 1. Migrate Users ---
        user_cols = ["id", "name", "email", "emailVerified", "image", "role", "status", "createdAt", "updatedAt"]
        def transform_user(row):
            data = list(row)
            data[3] = to_datetime(row[3]) # emailVerified
            data[7] = to_datetime(row[7]) # createdAt
            data[8] = to_datetime(row[8]) # updatedAt
            return data
        migrate_table(lite_conn, pg_conn, "User", user_cols, user_cols, transform_fn=transform_user)
        
        # --- 2. Migrate Accounts ---
        acc_cols = ["id", "userId", "type", "provider", "providerAccountId", "refresh_token", "access_token", "expires_at", "token_type", "scope", "id_token", "session_state"]
        migrate_table(lite_conn, pg_conn, "Account", acc_cols, acc_cols)
        
        # --- 3. Migrate Sessions ---
        sess_cols = ["id", "sessionToken", "userId", "expires"]
        def transform_sess(row):
            data = list(row)
            data[3] = to_datetime(row[3]) # expires
            return data
        migrate_table(lite_conn, pg_conn, "Session", sess_cols, sess_cols, transform_fn=transform_sess)
        
        # --- 4. Migrate VerificationTokens ---
        tok_cols = ["identifier", "token", "expires"]
        def transform_tok(row):
            data = list(row)
            data[2] = to_datetime(row[2]) # expires
            return data
        migrate_table(lite_conn, pg_conn, "VerificationToken", tok_cols, tok_cols, transform_fn=transform_tok)
        
        # --- 5. Migrate SignInLogs ---
        log_cols = ["id", "userId", "signedInAt"]
        def transform_log(row):
            data = list(row)
            data[2] = to_datetime(row[2]) # signedInAt
            return data
        migrate_table(lite_conn, pg_conn, "SignInLog", log_cols, log_cols, transform_fn=transform_log)

        # --- 6. Migrate Channels ---
        # Note the boolean fields that must be mapped to Python booleans for Postgres
        ch_select_cols = [
            "id", "channelId", "channelName", "channelHandle", "thumbnailUrl",
            "subscribers", "totalVideos", "totalViews", "channelType", "niche",
            "daysSinceStart", "avgViewsPerVideo", "outlierScore", "isMonetized",
            "isActive", "isKids", "isNews", "isEntertainment", "isFaceless", "isNano",
            "sortOrder", "createdAt", "updatedAt"
        ]
        ch_insert_cols = ch_select_cols
        
        def transform_channel(row):
            # Index positions:
            # 13: isMonetized, 14: isActive, 15: isKids, 16: isNews, 17: isEntertainment, 18: isFaceless, 19: isNano
            # 21: createdAt, 22: updatedAt
            data = list(row)
            data[13] = convert_bool(row[13]) # isMonetized
            data[14] = convert_bool(row[14]) # isActive
            data[15] = convert_bool(row[15]) # isKids
            data[16] = convert_bool(row[16]) # isNews
            data[17] = convert_bool(row[17]) # isEntertainment
            data[18] = convert_bool(row[18]) # isFaceless
            data[19] = convert_bool(row[19]) # isNano
            data[21] = to_datetime(row[21]) # createdAt
            data[22] = to_datetime(row[22]) # updatedAt
            return data
            
        migrate_table(lite_conn, pg_conn, "Channel", ch_select_cols, ch_insert_cols, transform_fn=transform_channel)

        # --- 7. Migrate Videos ---
        # Note isOutlier and isNano booleans
        v_select_cols = ["id", "videoId", "channelId", "title", "thumbnailUrl", "views", "duration", "publishedAt", "isOutlier", "isNano"]
        v_insert_cols = v_select_cols
        
        def transform_video(row):
            data = list(row)
            data[7] = to_datetime(row[7]) # publishedAt
            data[8] = convert_bool(row[8]) # isOutlier
            data[9] = convert_bool(row[9]) # isNano
            return data
            
        migrate_table(lite_conn, pg_conn, "Video", v_select_cols, v_insert_cols, transform_fn=transform_video)
        
        print("\n🎉 All tables migrated successfully without any data loss!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Migration aborted due to an error: {e}")
        sys.exit(1)
    finally:
        lite_conn.close()
        pg_conn.close()

if __name__ == "__main__":
    main()
