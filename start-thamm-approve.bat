@echo off
title ThammApprove Starter
color 0A

echo ========================================
echo     ThammApprove - PDF Approval System
echo ========================================
echo.

echo [1/3] Starte Backend Server (API)...
start "ThammApprove Backend" cmd /k "cd /d C:\Users\dhuhn\PyProjects\ThammApprove\backend && echo Backend wird gestartet... && npm run dev"

echo [2/3] Warte 5 Sekunden...
timeout /t 5 /nobreak >nul

echo [3/3] Starte Frontend (Webseite)...
start "ThammApprove Frontend" cmd /k "cd /d C:\Users\dhuhn\PyProjects\ThammApprove\frontend && echo Frontend wird gestartet... && npm start"

echo.
echo ========================================
echo     FERTIG! System wurde gestartet
echo ========================================
echo.
echo Die Webseite öffnet sich automatisch in deinem Browser.
echo Falls nicht, öffne manuell: http://localhost:3100
echo.
echo Backend API läuft auf: http://localhost:3101
echo Frontend läuft auf:     http://localhost:3100
echo.
echo Zum Beenden: Schließe beide Terminal-Fenster
echo.
pause