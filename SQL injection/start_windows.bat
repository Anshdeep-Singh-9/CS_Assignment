@echo off
REM CampusShield local educational demo launcher for Windows.
REM Double-click this file after extracting the zip.
cd /d "%~dp0"
echo ====================================================
echo  CampusShield SQL Injection Authentication Bypass Lab
echo  Open in browser: http://127.0.0.1:8000
echo  Press Ctrl+C here when finished.
echo ====================================================
echo.
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start "" "http://127.0.0.1:8000"
    py -3 server.py
) else (
    where python >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo Python 3 is required. Install Python 3.10 or newer.
        pause
        exit /b 1
    )
    start "" "http://127.0.0.1:8000"
    python server.py
)
if %ERRORLEVEL% NEQ 0 pause
