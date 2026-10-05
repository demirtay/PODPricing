# -*- coding: utf-8 -*-
"""POD Pricing YouTube kanalı için tek seferlik yetkilendirme.
Gökyüzü Postası ile aynı OAuth istemcisini (diecast-shorts-factory) kullanır; onay ekranında
"POD Pricing" kanalı seçilmelidir. Token yalnızca bu klasöre kaydedilir (git'e girmez).
"""
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

CLIENT_SECRET_PATH = Path(r"C:\Users\alidemirtay\Desktop\diecast-shorts-factory\youtube_credentials.json")
OUTPUT_TOKEN_PATH = Path(__file__).parent / "youtube_token.json"
SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]

if __name__ == "__main__":
    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRET_PATH), SCOPES)
    creds = flow.run_local_server(port=0, prompt="consent", open_browser=True,
                                  success_message="Yetkilendirme tamamlandi, bu sekmeyi kapatabilirsiniz.")
    OUTPUT_TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
    print(f"Token kaydedildi: {OUTPUT_TOKEN_PATH}")
