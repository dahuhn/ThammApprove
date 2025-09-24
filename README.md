# ThammApprove - PDF Approval System

Ein modernes PDF-Freigabesystem als Ersatz für Enfocus Review, mit vollständiger Integration in Enfocus Switch Workflows.

## Features

- 📄 **PDF-Anzeige im Browser** mit nativer Browser-PDF-Anzeige
- ✅ **Freigabe/Ablehnung** mit Kommentaren
- 📧 **E-Mail-Benachrichtigungen** mit sicheren, zeitlich begrenzten Links
- 🔄 **Enfocus Switch Integration** über Scripts und API
- 🐳 **Docker-Support** für einfaches Deployment
- 🔒 **Sichere Token-basierte Authentifizierung**
- ⏱️ **Automatische Bereinigung** abgelaufener Freigaben

## Schnellstart

### Netzwerk-Setup (Development)

**System läuft auf IP:** `172.16.0.66`

1. **Backend starten:**
```bash
cd backend
npm install
npm run dev
```
→ Läuft auf: http://172.16.0.66:3101

2. **Frontend starten:**
```bash
cd frontend
npm install
npm start
```
→ Läuft auf: http://172.16.0.66:3100

3. **Umgebungsvariablen sind bereits konfiguriert** für Netzwerk-Zugriff

### Schnellstart mit Batch-Datei

Einfach doppelklicken: `start-thamm-approve.bat`

### Docker Deployment

```bash
# .env Datei erstellen
cp .env.example .env
# Anpassen der Konfiguration in .env

# Container starten
docker-compose up -d
```

## Enfocus Switch Integration

### 1. Script Installation

⚠️ **WICHTIG:** Verwenden Sie die Switch-kompatiblen Versionen:
- ✅ `submit-approval-compatible.js`
- ✅ `check-approval-status-compatible.js`
- ❌ NICHT die ursprünglichen Scripts (enthalten modernes JS)

### 2. Workflow Setup

```
[Hot Folder]
    ↓
[Submit Approval Script]
    ↓
[Hold Job Element (60s)]
    ↓
[Check Status Script]
    ├─→ [Approved] → Produktion
    ├─→ [Rejected] → Korrektur
    └─→ [Pending] → Loop zurück zu Hold Job
```

### 3. Script Konfiguration

**Submit Script Properties:**
- `apiUrl`: http://172.16.0.66:3101 (oder deine Server-IP)
- `customerEmail`: Aus Jobticket/Metadata
- `customerName`: Optional

**Check Status Script Properties:**
- `checkInterval`: 60 (Sekunden)
- `maxWaitTime`: 7200 (2 Stunden)

## API Endpoints

### POST /api/approvals/create
Neue Freigabe erstellen (Multipart/form-data mit PDF)

### GET /api/approvals/status/:jobId
Status einer Freigabe abfragen

### GET /api/approvals/view/:token
Freigabe-Details für Frontend laden

### POST /api/approvals/approve/:token
PDF freigeben

### POST /api/approvals/reject/:token
PDF ablehnen

## Konfiguration

### E-Mail Setup

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=ihre-email@firma.de
SMTP_PASS=ihr-passwort
EMAIL_FROM=noreply@firma.de
```

### Sicherheit

```env
JWT_SECRET=generate-secure-random-string
APPROVAL_EXPIRY_DAYS=7
```

## Architektur

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Enfocus Switch │────▶│   Backend API   │────▶│    Database     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               ▲
                               │
                        ┌──────┴──────┐
                        │   Frontend  │
                        │  (React)    │
                        └─────────────┘
                               ▲
                               │
                        ┌──────┴──────┐
                        │   Customer  │
                        └─────────────┘
```

## Entwicklung

### Technologie-Stack

- **Backend:** Node.js, Express, TypeScript, Sequelize, SQLite
- **Frontend:** React, TypeScript, PDF.js
- **Switch:** JavaScript/Node.js Scripts
- **Deployment:** Docker, Docker Compose

### Projekt-Struktur

```
ThammApprove/
├── backend/            # Express API Server
│   ├── src/
│   │   ├── routes/    # API Endpoints
│   │   ├── services/  # Business Logic
│   │   ├── models/    # Datenbank-Modelle
│   │   └── utils/     # Hilfsfunktionen
├── frontend/          # React Web-App
│   ├── src/
│   │   ├── pages/     # Seiten-Komponenten
│   │   ├── components/# UI-Komponenten
│   │   └── services/  # API-Client
├── switch-scripts/    # Enfocus Switch Integration
└── docker-compose.yml # Container-Orchestrierung
```

## Wartung

### Logs
```bash
# Backend Logs
docker-compose logs -f backend

# Lokale Logs
tail -f backend/logs/combined.log
```

### Datenbank-Backup
```bash
# SQLite Datenbank sichern
cp data/database.sqlite backups/database-$(date +%Y%m%d).sqlite
```

### Bereinigung
Abgelaufene Freigaben werden automatisch alle 24 Stunden bereinigt.

## Wichtige Dateien & Dokumentation

- 📋 **START-ANLEITUNG.md** - Detaillierte Schritt-für-Schritt Anleitung
- ⚡ **BENUTZER-ANLEITUNG.md** - Komplette Nutzungsanleitung
- 🔧 **SWITCH-SCRIPT-FIX.md** - Switch-Kompatibilitätslösungen
- 🌐 **NETZWERK-KONFIGURATION.md** - Netzwerk-Setup Details
- 📊 **PROJECT-STATUS.md** - Aktueller Projektstand

## Support

Bei Fragen oder Problemen:
1. Prüfen Sie die entsprechenden **-FIX.md** Dateien
2. Logs prüfen: `backend/logs/combined.log`
3. API testen: `curl http://172.16.0.66:3101/health`
4. Frontend testen: http://172.16.0.66:3100

## Lizenz

Proprietär - Thamm GmbH