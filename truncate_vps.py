import psycopg2

def main():
    db_url = 'postgresql://niche_user:N1ch3_P_2026_Secure_Db@10.0.3.2:5432/niche_db'
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Cascade will also delete related rows in Video
    cur.execute('TRUNCATE "Channel" CASCADE')
    conn.commit()
    print("Successfully truncated Channel and Video tables.")
        
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
