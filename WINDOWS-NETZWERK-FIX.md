# Windows Netzwerk-Problem behoben

## Problem
Windows kann `HOST=0.0.0.0` nicht richtig verarbeiten in der package.json.

## Lösung
1. **HOST-Variable entfernt** aus package.json
2. **.env.local erstellt** mit korrekten Einstellungen
3. **Windows Batch-Script** als Alternative

## React Dev Server Verhalten:
- Standardmäßig ist React unter Windows oft von allen IPs erreichbar
- Falls nicht, zeigt der Server beim Start die verfügbaren IPs an

## Jetzt testen:

### Option 1: Standard Start
```bash
cd frontend
npm start
```
Achte auf die Ausgabe - React zeigt alle verfügbaren URLs an!

### Option 2: Batch-Script
Doppelklick auf: `start-frontend-network.bat`

## Was du beim Start siehst:

```
Local:            http://localhost:3100
On Your Network:  http://172.16.0.66:3100
```

Falls "On Your Network" nicht angezeigt wird:
- Windows Firewall prüfen
- Antivirus-Software prüfen
- Netzwerk-Profil auf "Privat" stellen

## Firewall-Regel erstellen:

1. Windows-Taste + R → `wf.msc`
2. "Eingehende Regeln" → "Neue Regel"
3. Port → TCP → 3100 und 3101
4. Verbindung zulassen

## Test vom anderen Rechner:

```bash
curl http://172.16.0.66:3100
curl http://172.16.0.66:3101/health
```