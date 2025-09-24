# 🚀 ThammApprove Installation Guide

**Revolutionäre PDF-Approval-Lösung mit Webhook-Integration**

## 📋 Übersicht

ThammApprove ersetzt das veraltete Enfocus Review mit einer modernen, webhook-basierten Lösung:
- **< 1 Sekunde Reaktionszeit** statt 60s Polling
- **Browser-basierte PDF-Freigabe** für Kunden
- **Direct Webhook Processing** in Switch
- **Doppelte PDF-Speicherung** für optimalen Workflow

## 🎯 Systemanforderungen

### Server (ThammApprove Backend):
- **Windows Server** oder Windows 10/11
- **Node.js 18+** (LTS empfohlen)
- **Port 3101** frei verfügbar
- **Netzwerk-Zugriff** zu Switch Server und E-Mail Server
- **Speicherplatz:** 2GB für PDF-Uploads

### Switch Server:
- **Enfocus Switch** (Version mit Webhook Element aus Appstore)
- **Port 51088** frei verfügbar
- **Netzwerk-Zugriff** zu ThammApprove Server
- **Webhook Element** installiert (aus Switch Appstore)

## 📦 Installation

### Schritt 1: Repository klonen

```bash
git clone https://github.com/dahuhn/ThammApprove.git
cd ThammApprove
```

### Schritt 2: Backend installieren

```bash
# Backend Dependencies installieren
cd backend
npm install

# .env Datei erstellen
cp .env.example .env
```

### Schritt 3: .env Konfiguration

Bearbeite `backend/.env`:

```env
# Server Configuration
PORT=3101
NODE_ENV=production

# Database (SQLite - automatisch erstellt)
DATABASE_PATH=./database.sqlite

# JWT Secret (WICHTIG: Ändern für Produktion!)
JWT_SECRET=your-super-secure-jwt-secret-CHANGE-THIS

# E-Mail Konfiguration (SMTP)
SMTP_HOST=mail.thamm.de
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@thamm.de
SMTP_PASS=your-email-password
EMAIL_FROM=noreply@thamm.de

# Frontend URL
FRONTEND_URL=http://172.16.0.66:3100

# File Upload
MAX_FILE_SIZE=52428800
UPLOAD_DIR=../uploads

# Approval Settings
APPROVAL_EXPIRY_DAYS=7
CLEANUP_INTERVAL_HOURS=24

# Switch Webhook Configuration (WICHTIG!)
SWITCH_WEBHOOK_ENABLED=true
SWITCH_WEBHOOK_URL=http://newswitchserver.thamm.local:51088/scripting/ThammApprove
SWITCH_WEBHOOK_TIMEOUT=5000
SWITCH_WEBHOOK_MAX_RETRIES=3
```

### Schritt 4: Frontend installieren (optional)

```bash
# Frontend Dependencies installieren
cd ../frontend
npm install

# Frontend .env erstellen
cp .env.example .env.local
```

Bearbeite `frontend/.env.local`:
```env
REACT_APP_API_URL=http://172.16.0.66:3101
```

### Schritt 5: Services starten

#### Backend starten:
```bash
cd backend
npm start
```

#### Frontend starten (optional):
```bash
cd frontend
npm start
```

**Oder mit bereitgestellten Batch-Dateien:**
```bash
# Windows Batch-Dateien verwenden
start-thamm-approve.bat
```

## 🔧 Switch Integration

### Schritt 1: Webhook Element installieren

1. **Enfocus Switch öffnen**
2. **App Store** öffnen → nach "Webhook" suchen
3. **Webhook Element** installieren
4. Switch **neu starten**

### Schritt 2: Switch Flow aufbauen

#### Flow-Struktur:
```
[Hot Folder] → [Submit Script] → [Pending Folder] ← [Direct Webhook] → [Approved/Rejected]
                                       ↑                    ↓
                                [Webhook Element] ─────────┘
```

### Schritt 3: Submit Script Element

**Element:** Script Element
**Script:** `switch-scripts/submit-approval-compatible.js`

**Properties:**
```
apiUrl = http://172.16.0.66:3101
customerEmail = kunde@beispiel.de
successName = Success
errorName = Error
```

**Connections:**
- Success → Pending Folder
- Error → Error Folder

### Schritt 4: Pending Folder

**Element:** Folder
**Name:** "Pending Approval"
**Properties:**
- **Keine spezielle Konfiguration nötig!**
- Normaler Folder - PDFs warten hier bis Webhook sie direkt findet und verarbeitet

### Schritt 5: Webhook Element

**Element:** Webhook (aus Appstore)
**Properties:**
```
Name = ThammApprove Webhook Receiver
Webhook Type = Incoming (Subscribe)
Port = 51088
Path = /scripting/ThammApprove
Method = POST
Content Type = application/json
Script = webhook-receiver-direct.js
```

**Script:** `switch-scripts/webhook-receiver-direct.js`

**Connections:**
- Connection "Approved" → Name: "Approved" → Approved Folder
- Connection "Rejected" → Name: "Rejected" → Rejected Folder

## 🧪 Installation testen

### 1. Backend Test
```bash
# Backend erreichbar?
curl http://172.16.0.66:3101/health

# Erwartete Antwort:
{"status":"OK","timestamp":"2025-01-15T10:00:00.000Z"}
```

### 2. Webhook Test
```bash
# Webhook-Verbindung testen
cd tools
node test-webhook.js --url http://newswitchserver.thamm.local:51088/scripting/ThammApprove --approved

# Erwartete Antwort:
✅ Webhook test SUCCESSFUL!
```

### 3. End-to-End Test

1. **PDF in Switch Hot Folder** legen
2. **Switch Log prüfen:** "Approval created with ID xyz"
3. **E-Mail erhalten** mit Freigabe-Link
4. **Im Browser PDF öffnen** und genehmigen
5. **Switch Log prüfen:** "Webhook received for job xyz"
6. **PDF in Approved Folder** finden

## 🔗 URLs und Endpoints

### ThammApprove Server:
- **Backend API:** http://172.16.0.66:3101
- **Frontend:** http://172.16.0.66:3100 (falls installiert)
- **Health Check:** http://172.16.0.66:3101/health
- **Webhook Test:** http://172.16.0.66:3101/api/approvals/webhook/test

### Switch Server:
- **Webhook Endpoint:** http://newswitchserver.thamm.local:51088/scripting/ThammApprove

## 🚨 Wichtige Sicherheitshinweise

### Produktion Setup:

1. **JWT_SECRET ändern:**
```bash
# Sicheren Random String generieren:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

2. **HTTPS verwenden:**
```env
# In .env für Produktion:
SWITCH_WEBHOOK_URL=https://newswitchserver.thamm.local:51089/scripting/ThammApprove
FRONTEND_URL=https://approve.thamm.de:3100
```

3. **Firewall konfigurieren:**
```
Port 3101: ThammApprove Server → Nur von Switch Server
Port 51088: Switch Server → Nur von ThammApprove Server
```

4. **Backup konfigurieren:**
```bash
# Automatisches Backup der Datenbank
sqlite3 database.sqlite ".backup backup-$(date +%Y%m%d).sqlite"
```

## 📝 Windows Service Installation (Empfohlen)

### Backend als Service:

1. **pm2 global installieren:**
```bash
npm install -g pm2
npm install -g pm2-windows-service
```

2. **Service konfigurieren:**
```bash
cd backend
pm2 start npm --name "thamm-approve-backend" -- start
pm2 save
pm2-service-install -n PM2
```

3. **Service starten:**
```bash
net start PM2
```

## 🔍 Logs und Monitoring

### Backend Logs:
```bash
# Live Logs anzeigen
tail -f backend/logs/combined.log

# Error Logs
tail -f backend/logs/error.log
```

### Switch Logs:
- Switch Designer → Log Panel → Debug Level aktivieren
- Nach "ThammApprove" Nachrichten suchen

## 📞 Support und Wartung

### Log-Dateien für Support:
```
backend/logs/combined.log
backend/logs/error.log
Switch Designer Logs
```

### Gesunde Metriken:
- **API Response Time:** < 500ms
- **Webhook Response Time:** < 1s
- **PDF Upload Success Rate:** > 99%
- **E-Mail Delivery Rate:** > 95%

### Wartung:
```bash
# Alte PDFs bereinigen (automatisch alle 24h)
# Datenbank komprimieren (monatlich)
sqlite3 database.sqlite "VACUUM;"

# Logs rotieren (wöchentlich)
cd backend/logs && gzip combined.log && touch combined.log
```

## 🎯 Nächste Schritte nach Installation

1. **Test-PDFs verarbeiten** und Workflow validieren
2. **E-Mail-Templates anpassen** (backend/src/services/email.service.ts)
3. **Backup-Strategie implementieren**
4. **Monitoring einrichten** (optional: Sentry, New Relic)
5. **Benutzer schulen** in neuer Browser-basierter Freigabe

---

**🚀 Herzlichen Glückwunsch!** ThammApprove ist jetzt installiert und ersetzt das alte Enfocus Review mit moderner Webhook-Technologie!

Bei Fragen oder Problemen: Logs prüfen und Troubleshooting-Guide konsultieren.