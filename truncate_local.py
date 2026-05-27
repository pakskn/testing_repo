import sqlite3

def main():
    conn = sqlite3.connect('prisma/dev.db')
    cur = conn.cursor()
    
    cur.execute('DELETE FROM "Video"')
    cur.execute('DELETE FROM "Channel"')
    conn.commit()
    print("Successfully deleted all rows from local Channel and Video tables.")
        
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
