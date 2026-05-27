import requests

def check(vid):
    urls = [
        f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg",
        f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
        f"https://i.ytimg.com/vi/{vid}/maxresdefault.jpg"
    ]
    print(f"Video {vid}:")
    for u in urls:
        r = requests.head(u)
        print(f"  {u} -> {r.status_code}")

check("_iyA31IlROc")
