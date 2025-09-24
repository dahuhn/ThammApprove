@echo off
echo Starte ThammApprove Frontend mit Netzwerk-Zugriff...

cd /d C:\Users\dhuhn\PyProjects\ThammApprove\frontend

echo Setting environment variables...
set PORT=3100
set REACT_APP_API_URL=http://172.16.0.66:3101

echo Starting React development server...
echo Frontend wird verfügbar sein unter:
echo - Lokal: http://localhost:3100
echo - Netzwerk: http://172.16.0.66:3100

npm start

pause