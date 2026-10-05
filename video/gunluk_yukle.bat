@echo off
rem Her gun: POD Pricing Shorts - yuklenmemis videolari zamanlayarak yukler. Sonuc yukleme_log.txt
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
echo ==== %date% %time% ==== >> yukleme_log.txt
"C:\Users\alidemirtay\Desktop\what-if-factory\.venv\Scripts\python.exe" -W ignore upload_shorts.py >> yukleme_log.txt 2>&1