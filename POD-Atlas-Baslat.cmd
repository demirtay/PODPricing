@echo off
cd /d "%~dp0"
set "POD_NODE=C:\Users\alidemirtay\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%POD_NODE%" set "POD_NODE=node"
start "" "http://127.0.0.1:4173"
"%POD_NODE%" scripts\server.cjs
pause
