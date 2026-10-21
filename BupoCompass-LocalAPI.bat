@echo off
title BupoCompass - API locale (PHP)
cd /d "%~dp0\api"

REM Verifier que .env existe
if not exist ".env" (
  echo .env manquant dans api\
  echo Copie api\.env.local.example -^> api\.env pour demarrer en mode SQLite zero-config
  echo.
  copy ".env.local.example" ".env"
  echo .env cree avec config SQLite par defaut.
  echo.
)

REM Verifier composer install
if not exist "vendor\autoload.php" (
  echo Vendor manquant - lancement de composer install...
  composer install
  if errorlevel 1 (
    echo.
    echo composer install a echoue. Verifie que PHP et composer sont installes.
    pause
    exit /b 1
  )
)

REM Si SQLite, initialiser la base si elle n'existe pas
findstr /I "DB_DRIVER=sqlite" .env >nul 2>&1
if not errorlevel 1 (
  if not exist "database\local.sqlite" (
    echo [SQLite] Initialisation de la base locale...
    php database\init-sqlite.php
  )
)

echo.
echo [API] Demarrage sur http://localhost:7000
echo [API] Endpoint test : http://localhost:7000/community/browse
echo [API] Ctrl+C pour arreter
echo.
php -S 0.0.0.0:7000 -t . index.php
pause
