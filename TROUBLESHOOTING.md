# 🔧 ThammApprove Troubleshooting Guide

## 🚨 Häufige Probleme und Lösungen

### 1. Backend startet nicht

#### Problem: `npm start` Fehler
```
Error: Cannot find module 'express'
```

**Lösung:**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
npm start
```

#### Problem: Port 3101 bereits belegt
```
Error: listen EADDRINUSE: address already in use :::3101
```

**Lösung:**
```bash
# Port-Nutzung prüfen
netstat -ano | findstr :3101

# Prozess beenden (PID aus netstat)
taskkill /PID <PID> /F

# Oder anderen Port in .env verwenden
PORT=3102
```

#### Problem: Datenbank-Fehler
```
Error: SQLITE_CANTOPEN: unable to open database file
```

**Lösung:**
```bash
# Verzeichnis-Berechtigung prüfen
mkdir uploads
chmod 755 uploads

# Datenbank neu erstellen lassen
rm database.sqlite
npm start
```

### 2. E-Mail-Versand funktioniert nicht

#### Problem: SMTP-Authentifizierung fehlgeschlagen
```
Error: Invalid login: 535 Authentication failed
```

**Lösung in .env:**
```env
# Korrekte SMTP-Einstellungen
SMTP_HOST=mail.thamm.de
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@thamm.de
SMTP_PASS=correct-password
```

**Test:**
```bash
# E-Mail-Konfiguration testen
curl -X POST http://localhost:3101/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com"}'
```

#### Problem: E-Mails kommen nicht an
1. **Spam-Ordner prüfen**
2. **Firewall/Port 587 prüfen**
3. **SMTP-Server-Logs prüfen**

### 3. Webhook-Probleme

#### Problem: "Connection refused" bei Webhook-Test
```bash
node test-webhook.js --url http://newswitchserver.thamm.local:51088/scripting/ThammApprove
❌ Connection refused
```

**Diagnostik:**
```bash
# 1. DNS-Auflösung testen
nslookup newswitchserver.thamm.local

# 2. Port-Verbindung testen
telnet newswitchserver.thamm.local 51088

# 3. Switch Server Status prüfen
# → Switch Designer: Webhook Element aktiv?
```

**Lösungen:**
- **Switch Server:** Webhook Element starten
- **Firewall:** Port 51088 öffnen
- **DNS:** Host-Eintrag in `/etc/hosts` oder Windows `hosts`-Datei

#### Problem: Webhook kommt an, aber Job wird nicht gefunden
```
Switch Log: "No job found for approval ID xyz"
```

**Diagnostik:**
```bash
# Private Data prüfen (in Switch Designer)
# Job → Properties → Private Data → ApprovalId vorhanden?
```

**Lösungen:**
- **Submit Script:** Läuft korrekt durch? ApprovalId gesetzt?
- **Timing:** Webhook zu schnell nach Submit?
- **Job-State:** Job noch im Hold Element?

### 4. Switch Integration Probleme

#### Problem: Submit Script Error "Customer email is required"
**Lösung in Switch Script Properties:**
```
customerEmail = kunde@beispiel.de
```

**Oder in Job Private Data:**
```
CustomerEmail = kunde@beispiel.de
```

#### Problem: Hold Element gibt Jobs nicht frei
**Diagnostik:**
```javascript
// Debug-Logging in webhook-receiver-hold-release.js aktivieren
job.log(LogLevel.Debug, "Job state before release: " + job.getState());
var released = job.release();
job.log(LogLevel.Debug, "Release result: " + released);
```

**Lösungen:**
- **Hold Element:** Release Mode = Manual
- **Script:** webhook-receiver-hold-release.js verwenden
- **Connection Namen:** "Approved", "Rejected" korrekt

#### Problem: Jobs landen in falschem Ordner
**Connection-Namen prüfen:**
```javascript
// In Switch Designer:
// Hold Element → Rechtsklick auf Connection → Properties → Name
// Muss exakt "Approved" oder "Rejected" heißen
```

### 5. PDF-Upload Probleme

#### Problem: "File too large" Fehler
**Lösung in .env:**
```env
MAX_FILE_SIZE=104857600  # 100MB statt 50MB
```

#### Problem: PDF wird nicht angezeigt im Browser
**CORS-Problem prüfen:**
```bash
# Browser Console → Network Tab
# 304/404 Errors bei PDF-Requests?
```

**Lösung:**
```javascript
// In backend/src/routes/approval.routes.ts
res.setHeader('Access-Control-Allow-Origin', '*');
```

### 6. Performance-Probleme

#### Problem: Lange API-Response-Zeiten
**Monitoring aktivieren:**
```javascript
// In backend/src/index.ts
app.use((req, res, next) => {
  console.time(req.method + ' ' + req.url);
  res.on('finish', () => {
    console.timeEnd(req.method + ' ' + req.url);
  });
  next();
});
```

**Lösungen:**
- **Datenbank:** `VACUUM` ausführen
- **Uploads:** Alte PDFs löschen
- **Logs:** Log-Rotation aktivieren

#### Problem: Switch wird langsam bei vielen wartenden Jobs
**Hold Element Limits setzen:**
```
Maximum Jobs = 100
Timeout = 2 Stunden
```

## 🔍 Debug-Strategien

### 1. Log-Level erhöhen

**Backend (.env):**
```env
NODE_ENV=development  # Aktiviert Debug-Logs
```

**Switch:**
```
Switch Designer → Log Panel → Level: Debug
Filter: "ThammApprove"
```

### 2. Network-Tracing

**Webhook-Requests verfolgen:**
```bash
# Windows: netsh
netsh trace start capture=yes tracefile=network.etl

# Test durchführen
node test-webhook.js --url ...

# Stoppen
netsh trace stop
```

**TCP-Verbindungen überwachen:**
```bash
netstat -an | findstr 51088  # Switch Port
netstat -an | findstr 3101   # Backend Port
```

### 3. Database-Debugging

**SQLite-Datenbank untersuchen:**
```bash
sqlite3 backend/database.sqlite

# Alle Approvals anzeigen
.schema Approvals
SELECT * FROM Approvals ORDER BY createdAt DESC LIMIT 5;

# Status-Verteilung
SELECT status, COUNT(*) FROM Approvals GROUP BY status;
```

## 📊 Monitoring und Health Checks

### 1. Automatische Health Checks

**Script erstellen (health-check.bat):**
```batch
@echo off
echo Checking ThammApprove Health...

curl -f http://localhost:3101/health || echo "Backend DOWN"
curl -f http://newswitchserver.thamm.local:51088/scripting/ThammApprove || echo "Switch DOWN"

echo Health check completed.
```

### 2. Performance-Metriken

**Gesunde Werte:**
- API Response Time: < 500ms
- Webhook Response Time: < 1000ms
- PDF Upload Success: > 99%
- E-Mail Delivery: > 95%
- Disk Usage: < 80%

**Überwachung:**
```bash
# Disk Usage
df -h uploads/

# Memory Usage (Backend)
tasklist /FI "IMAGENAME eq node.exe"

# Response Times
curl -w "%{time_total}" http://localhost:3101/health
```

## 🆘 Emergency Recovery

### 1. Service Recovery

**Backend crashed:**
```bash
# PM2 Service neu starten
pm2 restart thamm-approve-backend

# Oder manual
cd backend && npm start
```

**Datenbank korrupt:**
```bash
# Backup wiederherstellen
cp backup-20250115.sqlite database.sqlite

# Oder neu initialisieren
rm database.sqlite
npm start
```

### 2. Switch Recovery

**Hold Element verstopft:**
```
Switch Designer → Hold Element → rechts-click → "Release All Jobs"
```

**Webhook Element reagiert nicht:**
```
Switch Designer → Webhook Element → Stop → Start
```

## 📞 Support-Informationen sammeln

Für Support bitte folgende Informationen sammeln:

### 1. Log-Dateien:
```
backend/logs/combined.log     (letzte 100 Zeilen)
backend/logs/error.log        (komplette Datei)
Switch Designer Logs          (Export als TXT)
```

### 2. Konfiguration:
```
backend/.env                  (OHNE Passwörter!)
Switch Element Properties     (Screenshots)
```

### 3. System-Info:
```bash
# Backend System
node --version
npm --version
dir backend/node_modules

# Switch System
Switch Version und Build Number
Webhook Element Version
```

### 4. Test-Ergebnisse:
```bash
# Webhook Test
node tools/test-webhook.js --url ... > webhook-test.log 2>&1

# Health Check
curl http://localhost:3101/health > health-check.log 2>&1
```

---

## 💡 Proaktive Wartung

### Wöchentlich:
- [ ] Logs prüfen auf Errors
- [ ] Disk Space prüfen
- [ ] Test-PDF durchs System schicken

### Monatlich:
- [ ] Datenbank-Backup erstellen
- [ ] Alte PDFs bereinigen
- [ ] Performance-Metriken prüfen

### Jährlich:
- [ ] Sicherheits-Updates installieren
- [ ] SSL-Zertifikate erneuern
- [ ] Disaster Recovery Test

**Bei Problemen:** Logs sammeln → Troubleshooting Guide konsultieren → Support kontaktieren mit vollständigen Informationen! 🔧