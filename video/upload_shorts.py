# -*- coding: utf-8 -*-
"""video/out içindeki henüz yüklenmemiş Shorts'ları POD Pricing kanalına zamanlayarak yükler.
Her gün bir video, 15:00 UTC (ABD sabahı) yayına girecek şekilde. Yüklenenler uploaded.json'a yazılır.
Güvenlik: kanal adında "POD" geçmiyorsa (ör. yanlışlıkla Gökyüzü Postası token'ı) hiçbir şey yüklenmez.

Kullanım: python upload_shorts.py [--dry]
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out"
TOKEN = HERE / "youtube_token.json"
LOG = HERE / "uploaded.json"
SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly",
          "https://www.googleapis.com/auth/youtube.force-ssl"]
ORDER = ["printful-vs-printify", "gildan-5000", "mugs-11oz-white", "bella-canvas-3001", "tumblers-20oz", "gildan-18500",
         "comfort-colors-1717", "gildan-18000", "next-level-3600", "mugs-15oz", "gildan-64000"]


def youtube():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    creds = Credentials.from_authorized_user_file(str(TOKEN), scopes=SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN.write_text(creds.to_json(), encoding="utf-8")
    return build("youtube", "v3", credentials=creds)


def main(dry: bool):
    log = json.loads(LOG.read_text(encoding="utf-8")) if LOG.exists() else {}
    names = [n for n in ORDER if (OUT / f"{n}.mp4").exists()] + sorted(p.stem for p in OUT.glob("*.mp4") if p.stem not in ORDER)
    todo = [n for n in names if n not in log]
    if not todo:
        print("Yüklenecek yeni video yok.")
        return
    last = max([datetime.fromisoformat(v["publishAt"].replace("Z", "+00:00")) for v in log.values()], default=None)
    day = (last + timedelta(days=1)) if last else datetime.now(timezone.utc).replace(hour=15, minute=0, second=0, microsecond=0) + timedelta(days=1)
    if dry:
        for i, n in enumerate(todo):
            print((day + timedelta(days=i)).isoformat(), n)
        return
    from googleapiclient.http import MediaFileUpload
    yt = youtube()
    ch = yt.channels().list(part="snippet", mine=True).execute()["items"][0]["snippet"]["title"]
    if "POD" not in ch.upper():
        sys.exit(f"DURDURULDU: token '{ch}' kanalına ait; POD Pricing kanalı değil. youtube_auth.py ile doğru kanalı seç.")
    for i, n in enumerate(todo):
        meta = json.loads((OUT / f"{n}.json").read_text(encoding="utf-8"))
        when = (day + timedelta(days=i)).strftime("%Y-%m-%dT%H:%M:%SZ")
        body = {"snippet": {"title": meta["title"][:100], "description": meta["description"], "tags": meta["tags"], "categoryId": "26",
                            "defaultLanguage": "en", "defaultAudioLanguage": "en"},
                "status": {"privacyStatus": "private", "publishAt": when, "selfDeclaredMadeForKids": False}}
        req = yt.videos().insert(part="snippet,status", body=body, media_body=MediaFileUpload(str(OUT / f"{n}.mp4"), resumable=True))
        resp = None
        while resp is None:
            _, resp = req.next_chunk()
        log[n] = {"id": resp["id"], "publishAt": when, "title": meta["title"]}
        LOG.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{n}: https://youtu.be/{resp['id']} yayın {when}")


if __name__ == "__main__":
    main("--dry" in sys.argv)
