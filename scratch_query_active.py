import sqlite3

try:
    conn = sqlite3.connect('prisma/dev.db')
    cur = conn.cursor()
    cur.execute("SELECT channelName, thumbnailUrl FROM \"Channel\" WHERE channelName IN ('AppSourceHub', 'RuthDiazTV', 'Healthy Ambitions', 'Mount Pleasant Magazine')")
    rows = cur.fetchall()
    for r in rows:
        print(f"Name: {r[0]} | URL: {r[1]}")
    conn.close()
except Exception as e:
    print(e)
