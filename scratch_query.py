import sqlite3

conn = sqlite3.connect('prisma/dev.db')
cur = conn.cursor()

cur.execute("SELECT channelType, COUNT(*) FROM Channel GROUP BY channelType")
print("Channel counts by type:")
for row in cur.fetchall():
    print(f" - {row[0]}: {row[1]}")

cur.close()
conn.close()
