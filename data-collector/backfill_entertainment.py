"""
Entertainment + Faceless Backfill
- isEntertainment=1: WWE, Cricket, Drama, Cartoons, Interviews, Sports highlights, Stage shows
- isFaceless=1:      History, Science, Conspiracy, Finance etc. style educational channels
- ASMR/Relaxing channels stay in Long Form (NOT marked as entertainment)
"""
import sqlite3, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DB_PATH = '../prisma/dev.db'

ENT_CH_KW = [
    # WWE/Wrestling/MMA/Boxing
    'wwe','wwf','wrestling','smackdown','monday raw','aew ','tna wrestling',
    'ufc ','mma official','boxing official','fight network','bellator',
    # Cricket official
    'cricket official','ipl official','psl official','bcci','pcb official',
    'cricket australia','england cricket','cricket south africa',
    'cricket west indies','nz cricket','cricket board',
    # Football/Soccer official
    'fifa official','premier league official','la liga official',
    'bundesliga official','champions league official',
    'real madrid official','barcelona official','manchester united official',
    'liverpool official','chelsea official','arsenal official',
    # NBA/NFL/MLB official
    'nba official','nfl official','mlb official','nhl official',
    # Drama/TV Networks
    'ary digital','hum tv','geo drama','geo entertainment',
    'zee tv','star plus','colors tv','sony entertainment','star jalsha',
    'sun tv','star vijay','zee telugu','star maa','etv telugu',
    'ptv home','ptv drama','aplus drama','urdu1','express entertainment',
    'hum sitaray','bol entertainment','a plus entertainment',
    'star world','webseries official','web series official','ott official',
    # Official Cartoons
    'cartoon network','nickelodeon official','nick jr official',
    'disney channel official','disney junior official',
    'toon network','pokemon official','cartoon official',
    # Celebrity Interviews / Talk Shows
    'jimmy fallon','ellen degeneres','oprah official','tonight show',
    'late show official','late night official','the view official',
    'good morning america','today show','graham norton official',
    'james corden','conan official','seth meyers','jimmy kimmel',
    # Reality TV / Game Shows
    'bigg boss official','big boss official','the bachelor official',
    'survivor official','amazing race','master chef official',
    'kaun banega','jeopardy official','wheel of fortune official',
    # Sports Highlights (official)
    'highlights official','match highlights official','game highlights official',
    # Stage Shows / Concerts
    'stage show','live concert official','stage performance official',
    'mela official',
    # Entertainment in any language
    'sangeet ceremony','dance performance official','mujra',
    'bhojpuri official','bhojpuri film','tollywood official',
    'kollywood official','mollywood official','lollywood official',
    'bangla serial','bangla natok','hindi serial official',
    # International sports official
    'formula 1 official','f1 official','motogp official',
]

ENT_VIDEO_KW = [
    'wwe raw','wwe smackdown','wwe highlights','wwe match',
    'ipl highlights','psl highlights','cricket highlights',
    'full match official','official match highlights',
    'sangeet night','sangeet function','stage show performance',
    'drama episode','serial episode','full episode official',
    'mujra dance','item number official',
    'movie trailer official','film trailer official',
]

# ASMR/Relaxing channels → KEEP in Long Form (don't mark as entertainment)
KEEP_LF_KW = [
    'asmr','relaxing','sleep music','study music','lo-fi','lofi',
    'nature sounds','white noise','fireplace','rain sounds',
    'meditation','ambient music','chill music','peaceful',
]

# Faceless educational channels
FACELESS_NICHES = {
    'History','True Crime','Crime','Science','Space','Finance','Business',
    'Motivation','Psychology','Self Improvement','Conspiracy','Paranormal',
    'HFy Stories','Survival','Technology','AI','Nature','Wildlife',
}
FACELESS_KW = [
    'faceless','no face show','dark screen','ai narrated','narration channel',
    'documentary channel','explained channel','iceberg channel',
    'storytime channel','reddit stories','reddit channel',
    'dark lore','lore explained','mythology explained',
    'history explained','science explained','space explained',
    'true crime channel','finance explained','business explained',
    'conspiracy channel','paranormal channel','hfy stories',
]

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA busy_timeout=30000')

    rows = conn.execute(
        'SELECT channelId, channelName, channelHandle, niche FROM "Channel" WHERE isActive=1'
    ).fetchall()
    print(f'Total channels: {len(rows):,}')

    ent_ids = set()
    faceless_ids = set()
    keep_lf = set()

    for ch_id, name, handle, niche in rows:
        t = ' ' + (name or '').lower() + ' ' + (handle or '').lower() + ' '
        # Keep ASMR/relaxing in Long Form
        if any(kw in t for kw in KEEP_LF_KW):
            keep_lf.add(ch_id)
            continue
        if any(kw in t for kw in ENT_CH_KW):
            ent_ids.add(ch_id)
        # Faceless: niche match OR keyword match
        if (niche in FACELESS_NICHES) or any(kw in t for kw in FACELESS_KW):
            faceless_ids.add(ch_id)

    print(f'Entertainment (name): {len(ent_ids):,}')

    # Video title detection for entertainment
    vrows = conn.execute('''
        SELECT v.channelId, v.title FROM "Video" v
        JOIN "Channel" c ON v.channelId=c.channelId
        WHERE c.isActive=1
    ''').fetchall()
    for ch_id, title in vrows:
        if ch_id in keep_lf:
            continue
        t = (title or '').lower()
        if any(kw in t for kw in ENT_VIDEO_KW):
            ent_ids.add(ch_id)

    print(f'Entertainment (final): {len(ent_ids):,}')
    print(f'Faceless:              {len(faceless_ids):,}')

    BATCH = 500
    for i in range(0, len(ent_ids), BATCH):
        b = [(c,) for c in list(ent_ids)[i:i+BATCH]]
        conn.executemany('UPDATE "Channel" SET isEntertainment=1 WHERE channelId=?', b)
        conn.commit()

    for i in range(0, len(faceless_ids), BATCH):
        b = [(c,) for c in list(faceless_ids)[i:i+BATCH]]
        conn.executemany('UPDATE "Channel" SET isFaceless=1 WHERE channelId=?', b)
        conn.commit()

    print(f'isEntertainment=1 set: {len(ent_ids):,}')
    print(f'isFaceless=1 set:      {len(faceless_ids):,}')
    conn.close()
    print('DONE')

if __name__ == '__main__':
    main()
