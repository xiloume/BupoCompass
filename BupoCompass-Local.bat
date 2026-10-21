@echo off
title BupoCompass - Stack complete locale
cd /d "%~dp0"

REM Definit l'API en mode local pour le process Electron
set BUPO_API_URL=http://localhost:7000

REM Lance l'API PHP dans une fenetre separee
echo Demarrage de l'API locale...
start "BupoCompass API" cmd /k "%~dp0\BupoCompass-LocalAPI.bat"

REM Petit delai pour laisser PHP demarrer
timeout /t 2 /nobreak >nul

REM Lance l'app Electron (qui pointe vers localhost grace a BUPO_API_URL)
echo Demarrage de l'app...
npm run dev
pause
