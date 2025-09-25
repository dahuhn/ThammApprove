# Switch JavaScript Scripts (Ohne TypeScript)

Diese JavaScript-Scripts verwenden moderne JavaScript-Features (async/await, const/let, template strings) ohne TypeScript-Typisierung.

## 📋 Installation auf Switch-Server

### 1. Scripts mit SwitchScriptTool erstellen

```cmd
cd "C:\Program Files\Enfocus\Enfocus Switch\SwitchScriptTool"

SwitchScriptTool --create ThammApprove-Submit "C:\Switch Scripts" --JavaScript
SwitchScriptTool --create ThammApprove-WebhookProcessor "C:\Switch Scripts" --JavaScript
SwitchScriptTool --create ThammApprove-StatusCheck "C:\Switch Scripts" --JavaScript
```

**Beachte:** `--JavaScript` Flag für JavaScript statt TypeScript!

### 2. JavaScript-Code kopieren

**Kopiere den KOMPLETTEN Inhalt** der folgenden Dateien in die generierten `main.js` Dateien:

- `submit-approval.js` → `C:\Switch Scripts\ThammApprove-Submit\main.js`
- `webhook-json-processor.js` → `C:\Switch Scripts\ThammApprove-WebhookProcessor\main.js`
- `check-approval-status.js` → `C:\Switch Scripts\ThammApprove-StatusCheck\main.js`

### 3. In Switch Designer verwenden

Die Scripts sind sofort einsatzbereit - keine Kompilierung nötig!

## 🔧 Switch Designer Konfiguration

### ThammApprove-Submit Properties
- `apiUrl`: URL des ThammApprove Servers (default: http://172.16.0.66:3101)
- `customerEmail`: E-Mail des Kunden (oder aus Private Data)
- `customerName`: Name des Kunden (optional)
- `notificationEmail`: E-Mail für Benachrichtigungen (optional)
- `successName`: Name der Success-Connection (optional)
- `errorName`: Name der Error-Connection (optional)

### ThammApprove-WebhookProcessor Properties
Keine speziellen Properties - verarbeitet JSON vom Webhook Element automatisch.

### ThammApprove-StatusCheck Properties
- `apiUrl`: URL des ThammApprove Servers
- `checkInterval`: Prüfintervall in Sekunden (default: 60)
- `maxWaitTime`: Maximale Wartezeit in Sekunden (default: 7200 = 2h)
- `approvedName`, `rejectedName`, `timeoutName`, `pendingName`: Connection-Namen (optional)

## 🔗 Connection-Setup

### Submit-Script:
- **Output 1**: Success → **Pending Folder** (PDF wartet auf Webhook)
- **Null**: Error → Error-Behandlung

### Webhook-Processor:
- **Connection 1**: Approved → **Wait for Asset Tool**
- **Connection 2**: Rejected → **Wait for Asset Tool**
- **Connection 3**: Error → Fehlerbehandlung

### Status-Check (Fallback):
- **Connection 1**: Approved → Finale Approved-Verarbeitung
- **Connection 2**: Rejected → Finale Rejected-Verarbeitung
- **Connection 3**: Pending → Zurück in Warteschlange
- **Connection 4**: Timeout → Timeout-Behandlung

## ✅ Moderne JavaScript-Features

### Async/Await
```javascript
// Alle Switch-API Calls sind async
const fileName = await job.getName();
const apiUrl = await flowElement.getPropertyStringValue("apiUrl");
```

### Template Strings
```javascript
// Saubere String-Formatierung
await job.log(1, `${scriptName}: Processing ${fileName}`);
```

### Const/Let
```javascript
// Moderne Variablen-Deklaration
const scriptName = "ThammApprove Submit";
let customerEmail = await flowElement.getPropertyStringValue("customerEmail");
```

### Node.js Integration
```javascript
// Zugriff auf Node.js Module
const http = require('http');
const fs = require('fs');
```

## 🔥 Vorteile dieser Version

- ✅ **Keine TypeScript-Kompilierung** nötig
- ✅ **Moderne JavaScript-Syntax**
- ✅ **Async/Await** für bessere Performance
- ✅ **Direkt lauffähig** in Switch 2022+
- ✅ **Node.js Integration** für HTTP-Requests
- ✅ **Sauberer, wartbarer Code**

## 📁 Workflow-Integration

### 1. PDF-Einreichung
```
[Hot Folder] → [Submit-Script] → [Pending Folder]
```

### 2. Webhook-Processing (< 1s Reaktionszeit!)
```
[Backend] → [Webhook Element] → [JSON-Processor] → [Wait for Asset] → [Approved/Rejected]
                                       ↓                    ↓
                                 Extrahiert fileName    Findet PDF in Pending
```

### 3. Fallback-Polling (falls Webhook nicht funktioniert)
```
[Pending Folder] → [Status-Check] → [Approved/Rejected/Timeout]
```

## 🚀 Performance

- **Webhook-Reaktionszeit**: < 1 Sekunde
- **HTTP-Requests**: Asynchron mit Node.js
- **Multipart-Upload**: Effiziente PDF-Übertragung
- **Private Data**: Persistente Job-Informationen

## 🆘 Troubleshooting

### Script-Fehler debuggen:
- Switch Designer → Messages → Script errors
- Logs mit `await job.log(1, "Debug message")`

### Webhook testen:
```bash
curl -X POST http://newswitchserver.thamm.local:51088/scripting/ThammApprove \
  -H "Content-Type: application/json" \
  -d '{"jobId":"test123","fileName":"test.pdf","status":"approved"}'
```

### Common Issues:
- **"Property not found"**: Switch API hat sich geändert
- **"HTTP Error"**: Backend nicht erreichbar
- **Jobs hängen**: Webhook-Element läuft nicht

## 🎯 Das ist der produktionsreife Weg!

Moderne JavaScript-Syntax ohne TypeScript-Komplexität = Beste Balance aus Performance und Wartbarkeit!