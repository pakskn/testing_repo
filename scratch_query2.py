import sqlite3

conn = sqlite3.connect('prisma/dev.db')
cur = conn.cursor()

cur.execute("SELECT isActive, COUNT(*) FROM Channel GROUP BY isActive")
print("Channel counts by isActive:")
for row in cur.fetchall():
    print(f" - {row[0]}: {row[1]}")

cur.close()
conn.close()
