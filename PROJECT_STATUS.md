# ThammApprove - Project Status

## Projektübersicht
ThammApprove ist ein PDF-Approval-System, das Enfocus Review ersetzen soll. Das System verwendet eine webhook-basierte Architektur für sofortige Benachrichtigungen (<1s) anstatt des alten Polling-Systems (60s).

## Aktuelle Systemarchitektur

### Backend (Node.js/Express)
- **Port**: 3101
- **Database**: SQLite mit Sequelize ORM
- **Email**: Nodemailer mit SMTP (mail.thamm.de)
- **API Endpoints**:
  - `/api/approvals` - PDF Upload und Approval-Management
  - `/api/webhook` - Webhook für Approval-Antworten
  - `/health` - Health Check
- **Static Files**: Serviert Frontend Production Build und Uploads

### Frontend (React)
- **Build**: Production Build wird vom Backend serviert
- **URL**: Gleiche wie Backend (Port 3101)
- **Features**: PDF-Viewer, Approval-Interface, Responsive Design

### Switch Integration
- **Scripts**: ES5-kompatible JavaScript-Scripte
- **Connections**: Named Connections (apiUrl, webhookUrl, approverEmail)
- **Upload**: Multipart/form-data für PDF-Display im Browser

## Gelöste Probleme

### ✅ API Integration
- Switch HTTP API korrekt implementiert mit `setAttachedFile()` und `addParameter()`
- ES5-Kompatibilität sichergestellt

### ✅ Database Model Shadowing
- Sequelize Model-Issue behoben: `public token!: string` → `declare token: string`
- Token-Generierung funktioniert korrekt

### ✅ SMTP Configuration
- Lazy Transporter Initialization für korrekte .env-Loading
- SMTP Konfiguration: mail.thamm.de mit thamm\switch/switch
- EMAIL_FROM: switch@thamm.de (Permission-Issue behoben)

### ✅ Email Delivery
- Erfolgreich getestet - E-Mails werden zugestellt
- Links mit target="_blank" für neue Tabs

## Aktuelles Problem

### ❌ Content Security Policy (CSP)
- **Problem**: `frame-ancestors 'self'` blockiert Approval-Links in Browsern
- **Fehler**: "Content-Security-Policy: Die Einstellungen der Seite haben das Laden einer Ressource (frame-ancestors) auf <unknown> blockiert"
- **Betroffen**: Firefox, Chrome, alle Browser
- **Aktueller Lösungsansatz**: React Development Server durch Production Build ersetzen

## Letzte Änderungen

### Backend Konfiguration (src/index.ts)
```javascript
// Explizite .env Pfad-Konfiguration
const envPath = path.join(__dirname, '../.env');
const envResult = dotenv.config({ path: envPath });

// Helmet CSP-Konfiguration
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  frameguard: false  // X-Frame-Options deaktiviert
}));

// Frontend Production Build servieren
app.use(express.static(path.join(__dirname, '../../frontend/build')));
```

### CSP Header Konfiguration
- **Backend**: X-Frame-Options deaktiviert in helmet
- **Frontend Build Config**: Diverse CSP-Übersteuerungen konfiguriert
- **HTML Meta Tags**: `frame-ancestors *;` gesetzt

## Nächste Schritte

1. **Production Build erstellen und testen**
   - Frontend mit `npm run build` kompilieren
   - Backend neustarten
   - Approval-Links in verschiedenen Browsern testen

2. **CSP-Problem final lösen**
   - Falls Production Build CSP nicht löst: Alternative Header-Strategien
   - ggf. Nginx-Reverse-Proxy mit Header-Overrides

## Technische Details

### Environment Variablen (.env)
```
PORT=3101
SMTP_HOST=mail.thamm.de
SMTP_PORT=587
SMTP_USER=thamm\switch
SMTP_PASS=switch
EMAIL_FROM=switch@thamm.de
FRONTEND_URL=http://localhost:3101
```

### Switch Named Connections
- **apiUrl**: http://172.16.0.66:3101/api/approvals
- **webhookUrl**: http://172.16.0.66:3101/api/webhook
- **approverEmail**: Konfigurierbar je Workflow

## Projektstand: 95% Complete
- ✅ PDF Upload funktioniert
- ✅ Email-Versand funktioniert
- ✅ Database-Operations funktionieren
- ✅ Switch-Integration funktioniert
- ❌ CSP Browser-Kompatibilität (letztes verbleibendes Problem)

---
*Letztes Update: 25.09.2025 - CSP-Problem wird durch Production Build-Ansatz gelöst*