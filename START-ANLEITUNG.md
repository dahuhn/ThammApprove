# ThammApprove - Schritt-für-Schritt Startanleitung für Anfänger

## Voraussetzungen installieren

### 1. Node.js installieren (WICHTIG!)

1. Öffne deinen Browser und gehe zu: https://nodejs.org
2. Lade die **LTS Version** herunter (der große grüne Button links)
3. Führe die heruntergeladene Datei aus
4. Klicke immer auf "Next" und lasse alle Standardeinstellungen
5. Am Ende "Finish" klicken

**Test ob es funktioniert hat:**
- Öffne die Windows-Eingabeaufforderung (Windows-Taste + R, dann "cmd" eingeben)
- Tippe ein: `node --version`
- Es sollte eine Versionsnummer erscheinen (z.B. v20.11.0)
- Tippe ein: `npm --version`
- Es sollte auch eine Versionsnummer erscheinen (z.B. 10.2.4)

## Das Projekt zum Laufen bringen

### Option A: Der einfache Weg (Empfohlen für den Anfang)

#### Schritt 1: Terminal öffnen

1. Öffne den Windows Explorer
2. Navigiere zu: `C:\Users\dhuhn\PyProjects\ThammApprove`
3. Halte die SHIFT-Taste gedrückt und klicke mit der rechten Maustaste in den leeren Bereich
4. Wähle "PowerShell-Fenster hier öffnen" oder "Eingabeaufforderung hier öffnen"

#### Schritt 2: Backend starten (API-Server)

Im Terminal eingeben (kopiere jeden Befehl einzeln und drücke Enter):

```bash
cd backend
```

Dann:
```bash
npm install
```

**WICHTIG:** Dieser Befehl lädt alle benötigten Pakete herunter. Das kann 2-5 Minuten dauern!
Du siehst viele Zeilen durchlaufen - das ist normal. Warte bis du wieder den Cursor siehst.

Wenn fertig, erstelle die Konfigurationsdatei:
```bash
copy .env.example .env
```

Jetzt starte das Backend:
```bash
npm run dev
```

**Du solltest sehen:**
```
Server running on port 3101
Frontend URL: http://localhost:3100
Database connection established
Database synchronized
```

⚠️ **WICHTIG:** Dieses Terminal-Fenster muss offen bleiben! Nicht schließen!

#### Schritt 3: Frontend starten (Webseite)

**Öffne ein NEUES Terminal-Fenster** (gleiches Vorgehen wie in Schritt 1)

Navigiere wieder zum Projekt:
```bash
cd C:\Users\dhuhn\PyProjects\ThammApprove
```

Dann ins Frontend wechseln:
```bash
cd frontend
```

Pakete installieren:
```bash
npm install
```

**Hinweis:** Auch das dauert wieder einige Minuten. Du siehst eventuell Warnungen - die kannst du erstmal ignorieren.

Konfigurationsdatei erstellen:
```bash
copy .env.example .env
```

Frontend starten:
```bash
npm start
```

**Was passiert:**
- Nach etwa 30 Sekunden sollte sich automatisch dein Browser öffnen
- Falls nicht, öffne selbst einen Browser und gehe zu: http://localhost:3100
- Du solltest die ThammApprove Startseite sehen!

## Test ob alles funktioniert

### 1. Backend testen

Öffne einen Browser und gehe zu:
```
http://localhost:3101/health
```

Du solltest sehen:
```json
{"status":"ok","timestamp":"2025-09-24T..."}
```

### 2. Frontend testen

Gehe zu:
```
http://localhost:3100
```

Du solltest die ThammApprove Willkommensseite mit einem lila Hintergrund sehen.

## Wichtige Ordner für die Nutzung

Nach dem Start findest du hier die wichtigen Daten:

- **PDFs werden gespeichert in:** `C:\Users\dhuhn\PyProjects\ThammApprove\uploads`
- **Datenbank liegt in:** `C:\Users\dhuhn\PyProjects\ThammApprove\backend\database.sqlite`
- **Logs findest du in:** `C:\Users\dhuhn\PyProjects\ThammApprove\backend\logs`

## E-Mail-Versand konfigurieren (Optional)

1. Öffne die Datei: `C:\Users\dhuhn\PyProjects\ThammApprove\backend\.env`
2. Ändere diese Zeilen mit deinen E-Mail-Daten:

```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=deine-email@firma.de
SMTP_PASS=dein-passwort
EMAIL_FROM=noreply@firma.de
```

3. Speichere die Datei
4. Starte das Backend neu (Strg+C im Backend-Terminal, dann wieder `npm run dev`)

## Programm beenden

1. Gehe zum Terminal mit dem Backend
2. Drücke `Strg + C`
3. Bestätige mit `J` oder `Y`
4. Gehe zum Terminal mit dem Frontend
5. Drücke `Strg + C`
6. Bestätige mit `J` oder `Y`

## Programm neu starten

### Backend:
```bash
cd C:\Users\dhuhn\PyProjects\ThammApprove\backend
npm run dev
```

### Frontend (in neuem Terminal):
```bash
cd C:\Users\dhuhn\PyProjects\ThammApprove\frontend
npm start
```

## Probleme und Lösungen

### Problem: "npm ist nicht bekannt"
**Lösung:** Node.js ist nicht installiert oder der Computer muss neu gestartet werden nach der Installation.

### Problem: "Port 3100/3101 ist bereits belegt"
**Lösung:** Ein anderes Programm nutzt den Port. Beende alle Terminal-Fenster und starte neu.

### Problem: Seite lädt nicht
**Lösung:**
1. Prüfe ob beide Terminals laufen (Backend UND Frontend)
2. Schaue in beiden Terminals nach Fehlermeldungen
3. Browser-Cache leeren (Strg+F5)

### Problem: E-Mails werden nicht versendet
**Lösung:** Die E-Mail-Konfiguration in der .env Datei prüfen. Ohne korrekte SMTP-Daten funktioniert der E-Mail-Versand nicht.

## Automatischer Start (für später)

Wenn das System produktiv genutzt werden soll, kann man ein Batch-Script erstellen:

1. Erstelle eine neue Datei `start-thamm-approve.bat` auf dem Desktop
2. Füge ein:

```batch
@echo off
echo Starte ThammApprove Backend...
start cmd /k "cd /d C:\Users\dhuhn\PyProjects\ThammApprove\backend && npm run dev"

timeout /t 5

echo Starte ThammApprove Frontend...
start cmd /k "cd /d C:\Users\dhuhn\PyProjects\ThammApprove\frontend && npm start"

echo.
echo ThammApprove wurde gestartet!
echo Backend: http://localhost:3101
echo Frontend: http://localhost:3100
pause
```

3. Doppelklick auf die .bat Datei startet beide Dienste

## Support

Bei Problemen:
1. Screenshot von den Fehlermeldungen machen
2. Beide Terminal-Fenster im Screenshot zeigen
3. Die Ausgabe von `npm --version` und `node --version` notieren

---

**Tipp:** Beim ersten Mal dauert alles etwas länger. Beim zweiten Start geht es viel schneller, weil alle Pakete bereits installiert sind!