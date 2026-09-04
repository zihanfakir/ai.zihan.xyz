@echo off
title Alokpoth AI Server
echo Starting Alokpoth AI Server...
cd /d "%~dp0"
cd server

:: Open browser after 2 seconds without pausing the script
start "" "http://localhost:5000"

:: Start the server
node server.js

pause
