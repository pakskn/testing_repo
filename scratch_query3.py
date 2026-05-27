import sqlite3

conn = sqlite3.connect('prisma/dev.db')
cur = conn.cursor()

# Long form count
cur.execute("SELECT COUNT(*) FROM Channel WHERE channelType = 'long' AND isActive = 1")
print(f"Long form count: {cur.fetchone()[0]}")

cur.close()
conn.close()
