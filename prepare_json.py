import json
import glob
import os
import uuid

def main():
    json_files = glob.glob(r'D:\Waqasalee\Niche R Tool\long-form-channels-2026-05-25-by-nexlev*.json')
    
    unique_channels = {}
    
    for fpath in json_files:
        with open(fpath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for ch in data:
                # url is like youtube.com/channel/UCef...
                url = ch.get('url', '')
                if 'youtube.com/channel/' in url:
                    ch_id = url.split('youtube.com/channel/')[-1]
                elif 'youtube.com/c/' in url:
                    ch_id = url.split('youtube.com/c/')[-1]
                elif 'youtube.com/@' in url:
                    ch_id = url.split('youtube.com/@')[-1]
                else:
                    ch_id = url
                    
                ch['channelId'] = ch_id
                
                if ch_id not in unique_channels:
                    unique_channels[ch_id] = ch
                    
    combined = list(unique_channels.values())
    print(f"Processed {len(json_files)} files.")
    print(f"Found {len(combined)} unique channels.")
    
    with open('combined_channels.json', 'w', encoding='utf-8') as out_f:
        json.dump(combined, out_f, indent=2)

if __name__ == '__main__':
    main()
