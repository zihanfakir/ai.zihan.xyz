@echo off
title Alora AI Server
echo Starting Alora AI Server...
cd /d "%~dp0"
cd server

:: Open browser after 2 seconds without pausing the script
start "" "http://localhost:5000"

:: Start the server
node server.js

pause
