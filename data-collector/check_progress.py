import sqlite3
c = sqlite3.connect("../prisma/dev.db")
sf = c.execute('SELECT COUNT(*) FROM "Channel" WHERE channelType="short_form"').fetchone()[0]
v = c.execute('SELECT COUNT(*) FROM "Video" v JOIN "Channel" ch ON v.channelId=ch.channelId WHERE ch.channelType="short_form"').fetchone()[0]
ch_with_v = c.execute('SELECT COUNT(DISTINCT v.channelId) FROM "Video" v JOIN "Channel" ch ON v.channelId=ch.channelId WHERE ch.channelType="short_form"').fetchone()[0]
print(f"Short_form channels: {sf}")
print(f"Channels with videos: {ch_with_v}")
print(f"Total short_form videos: {v}")
print(f"Avg videos per channel: {v//max(ch_with_v,1)}")
c.close()
