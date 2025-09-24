# ⚡ ThammApprove Quick Start

**In 15 Minuten von 0 zum funktionierenden PDF-Approval-System!**

## 🎯 Was du bekommst

- **< 1 Sekunde** PDF-Freigabe statt 60s Polling
- **Browser-basierte** Freigabe für Kunden
- **Automatische E-Mail** Benachrichtigungen
- **Switch Integration** mit Direct Webhook Processing

## 🚀 5-Minuten-Setup (Backend)

### 1. Repository klonen
```bash
git clone https://github.com/dahuhn/ThammApprove.git
cd ThammApprove/backend
```

### 2. Dependencies installieren
```bash
npm install
```

### 3. Minimal-Konfiguration
```bash
# .env erstellen
cp .env.example .env
```

**Nur diese Zeilen ändern:**
```env
# E-Mail für Tests
SMTP_HOST=mail.thamm.de
SMTP_USER=noreply@thamm.de
SMTP_PASS=your-password

# Switch Webhook URL
SWITCH_WEBHOOK_URL=http://newswitchserver.thamm.local:51088/scripting/ThammApprove
```

### 4. Backend starten
```bash
npm start
```

**✅ Erfolgreich wenn:**
```
🚀 ThammApprove Server running on port 3101
📧 Email service configured
📊 Database initialized
🔗 Webhook service ready
```

## 🔧 5-Minuten-Setup (Switch)

### 1. Webhook Element installieren
- Switch App Store → "Webhook" → Install
- Switch neu starten

### 2. Scripts kopieren
Kopiere diese 2 Dateien nach Switch:
- `switch-scripts/submit-approval-compatible.js`
- `switch-scripts/webhook-receiver-direct.js` ⭐ NEU - DIRECT PROCESSING

### 3. Minimal-Flow erstellen
```
[Hot Folder] → [Submit Script] → [Pending Folder] ← [Webhook findet Job direkt] → [Approved Folder]
                                       ↑                                ↓
                                [Webhook Element] ──────────────────┘
```

**Element-Konfiguration:**

#### Submit Script:
- **Script:** submit-approval-compatible.js
- **Property:** apiUrl = http://172.16.0.66:3101
- **Property:** customerEmail = test@beispiel.de
- **Success → Pending Folder** (normaler Folder!)

#### Pending Folder:
- **Typ:** Normaler Folder
- **Name:** z.B. "Pending Approval"
- **Keine spezielle Konfiguration nötig!**

#### Webhook Element:
- **Port:** 51088
- **Path:** /scripting/ThammApprove
- **Script:** webhook-receiver-direct.js
- **Connection "Approved"** → Approved Folder
- **Connection "Rejected"** → Rejected Folder

## 🧪 2-Minuten-Test

### 1. Backend-Test
```bash
curl http://localhost:3101/health
# Erwartung: {"status":"OK"}
```

### 2. Webhook-Test
```bash
cd tools
node test-webhook.js --approved
# Erwartung: ✅ Webhook test SUCCESSFUL!
```

### 3. End-to-End-Test
1. **PDF** in Switch Hot Folder legen
2. **E-Mail** sollte ankommen mit Link
3. **Browser:** Link öffnen → "Approve" klicken
4. **Switch:** PDF sollte sofort in Approved Folder landen

## 🎉 Fertig!

**Wenn alles funktioniert:**
- PDF-Freigabe in < 1 Sekunde ⚡
- Kunde bekommt E-Mail mit Browser-Link 📧
- Automatische Weiterleitung in Switch 🔄
- Keine manuelle Polling-Überwachung nötig 🎯

## 🔧 Erweiterte Konfiguration (optional)

### Frontend installieren (für Admin-Interface):
```bash
cd ../frontend
npm install
npm start
# → http://localhost:3100
```

### Weitere Switch-Connections:
```
Custom Hold Script Connections:
• Connection 1 → "Approved" → Approved Folder
• Connection 2 → "Rejected" → Rejected Folder
• Connection 3 → "Timeout" → Timeout Folder (nach 2h)
```

### Production-Settings:
```env
# In .env für Produktion
NODE_ENV=production
JWT_SECRET=your-secure-random-string
SWITCH_WEBHOOK_URL=https://newswitchserver.thamm.local:51089/scripting/ThammApprove
```

## 🆘 Schnelle Problemlösung

### Backend startet nicht?
```bash
# Node-Version prüfen (braucht 18+)
node --version

# Port-Konflikt?
netstat -ano | findstr :3101
```

### Webhook funktioniert nicht?
```bash
# Switch Server erreichbar?
ping newswitchserver.thamm.local

# Port offen?
telnet newswitchserver.thamm.local 51088
```

### E-Mail kommt nicht an?
- Spam-Ordner prüfen
- SMTP-Credentials korrekt?
- Port 587 offen?

### PDF hängt in Switch?
- **Pending Folder:** PDFs sollten nach Webhook-Processing weg sein
- **Webhook Element:** Läuft und empfängt Requests?
- **Private Data:** ApprovalId zwischen Submit und Webhook korrekt?
- **Connection-Namen:** "Approved", "Rejected" korrekt benannt?

## 📚 Weitere Dokumentation

- **Vollständige Installation:** [INSTALLATION.md](INSTALLATION.md)
- **Detaillierte Problemlösung:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Direct Webhook Processing:** [DIRECT-WEBHOOK-EXPLAINED.md](switch-scripts/DIRECT-WEBHOOK-EXPLAINED.md)

---

**🚀 In 15 Minuten von alter Polling-Lösung zur modernen Webhook-Integration!**

Bei Problemen: Logs prüfen → Troubleshooting Guide → Quick Fix versuchen → Support mit vollständigen Logs kontaktieren! ⚡