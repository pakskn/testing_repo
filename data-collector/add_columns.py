import sqlite3
c = sqlite3.connect("../prisma/dev.db")
for col, tbl in [("isNano","Channel"), ("isNano","Video")]:
    try:
        c.execute(f'ALTER TABLE "{tbl}" ADD COLUMN {col} INTEGER NOT NULL DEFAULT 0')
        print(f"{tbl}.{col} added")
    except Exception as e:
        print(f"{tbl}.{col}: {e}")
c.commit(); c.close(); print("Done")
