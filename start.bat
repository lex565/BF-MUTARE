@echo off
title BF Mutare Website
cd /d "%~dp0"

echo Starting BF Mutare Website...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Start the dev server
echo Starting dev server on http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

start http://localhost:3000

REM Wait a moment for browser to open, then start server
timeout /t 2 /nobreak
npm run dev

pause
