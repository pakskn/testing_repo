import gzip
import sqlite3
import shutil

print("Extracting backup...")
with gzip.open('prisma/dev.db.gz', 'rb') as f_in:
    with open('prisma/dev_backup.db', 'wb') as f_out:
        shutil.copyfileobj(f_in, f_out)

print("Querying backup...")
conn = sqlite3.connect('prisma/dev_backup.db')
cur = conn.cursor()

cur.execute("SELECT channelType, COUNT(*) FROM Channel GROUP BY channelType")
print("Channel counts by type in backup:")
for row in cur.fetchall():
    print(f" - {row[0]}: {row[1]}")

cur.close()
conn.close()
