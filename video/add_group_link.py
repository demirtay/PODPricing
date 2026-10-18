# -*- coding: utf-8 -*-
"""Yüklenmiş POD Pricing Shorts açıklamalarına Facebook grubu satırını ekler (uploaded.json'daki videolar).
Zaten içerenleri atlar. Kullanım: python add_group_link.py [--dry]
"""
import json
import sys

from upload_shorts import LOG, FB_GROUP, with_group, youtube


def main(dry: bool):
    ids = [v["id"] for v in json.loads(LOG.read_text(encoding="utf-8")).values()]
    yt = youtube()
    ch = yt.channels().list(part="snippet", mine=True).execute()["items"][0]["snippet"]["title"]
    if "POD" not in ch.upper():
        sys.exit(f"DURDURULDU: token '{ch}' kanalına ait.")
    done = skip = 0
    for i in range(0, len(ids), 50):
        for it in yt.videos().list(part="snippet", id=",".join(ids[i:i + 50])).execute()["items"]:
            sn = it["snippet"]
            if FB_GROUP in sn.get("description", ""):
                skip += 1
                continue
            new = with_group(sn.get("description", ""))
            if dry:
                if not done:
                    print("ORNEK", it["id"], "\n" + new + "\n---")
                done += 1
                continue
            body = {"id": it["id"], "snippet": {k: sn[k] for k in ("title", "categoryId", "tags", "defaultLanguage", "defaultAudioLanguage") if k in sn}}
            body["snippet"]["description"] = new
            yt.videos().update(part="snippet", body=body).execute()
            done += 1
            print("guncellendi", it["id"], sn["title"][:60])
    print(f"{'(deneme) ' if dry else ''}guncellenecek/guncellenen: {done}, zaten var: {skip}, toplam: {len(ids)}")


if __name__ == "__main__":
    main("--dry" in sys.argv)
