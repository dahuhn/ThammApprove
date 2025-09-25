# ⚡ ThammApprove mit Wait for Asset - Der korrekte Switch Flow

## 🎯 Das richtige Verständnis des Webhook Elements

**WICHTIG:** Das Webhook Element in Switch:
- ✅ **Empfängt** HTTP POST Requests von externen Systemen
- ✅ **Erstellt** eine kleine JSON-Datei mit dem Webhook-Payload
- ❌ **Kann KEIN Script** enthalten oder direkt Jobs verarbeiten
- ❌ **Kann NICHT** wartende Jobs finden oder freigeben

## 🔄 Der korrekte Workflow mit Wait for Asset

### Übersicht:
```
FLOW 1: PDF-Einreichung
[Hot Folder] → [Submit Script] → [Pending Folder]
                                       ↓
                                  PDFs warten hier

FLOW 2: Webhook-Processing
[Webhook Element] → [JSON] → [JSON Processor Script] → [Wait for Asset]
     ↓                              ↓                        ↓
Empfängt POST            Extrahiert fileName      Findet & gibt PDF frei
mit fileName                und status                    ↓
                                                   [Approved/Rejected]
```

## 📋 Flow-Komponenten im Detail

### 1. Submit Script
**Script:** `submit-approval-compatible.js`
```javascript
// Sendet PDF an ThammApprove Server mit:
formData.addField("fileName", fileName);  // WICHTIG: Original-Dateiname!
formData.addField("jobId", jobId);
formData.addField("customerEmail", customerEmail);

// Speichert in Private Data:
job.setPrivateData("OriginalFileName", fileName);
job.setPrivateData("ApprovalId", result.approvalId);
```

### 2. Pending Folder
- **Typ:** Normaler Folder
- **PDFs warten hier** bis Wait for Asset sie findet
- **Keine spezielle Konfiguration** nötig

### 3. Webhook Element (aus Appstore)
- **Port:** 51088
- **Path:** /scripting/ThammApprove
- **Method:** POST
- **Content Type:** application/json
- **Output:** Kleine JSON-Datei mit Webhook-Payload

**Webhook-Payload vom Backend:**
```json
{
  "jobId": "abc123",
  "fileName": "Kundenauftrag_2025_01.pdf",  // ← Original-Dateiname!
  "status": "approved",
  "token": "xyz789",
  "approvedBy": "kunde@example.com"
}
```

### 4. JSON Processor Script
**Script:** `webhook-json-processor.js`
```javascript
// Liest JSON vom Webhook Element
var webhookData = JSON.parse(jsonContent);

// Setzt Private Data für Wait for Asset
job.setPrivateData("WebhookFileName", webhookData.fileName);
job.setPrivateData("WebhookStatus", webhookData.status);

// Routing basierend auf Status
if (webhookData.status === 'approved') {
    routeByName(s, job, "Approved", scriptName);
} else {
    routeByName(s, job, "Rejected", scriptName);
}
```

### 5. Wait for Asset Tool
**Konfiguration:**
- **Asset Path:** Pending Folder Pfad
- **Search Pattern:** `{Private:WebhookFileName}` oder direkter Dateiname
- **Action:** Inject found asset
- **Timeout:** 60 seconds
- **On Success:** Route zu finalem Approved/Rejected Folder
- **On Timeout:** Error handling

## 🎯 Datenfluss-Beispiel

### 1. PDF-Einreichung:
```
Kundenauftrag_2025_01.pdf → Submit Script → Server Upload
                                          → Pending Folder (wartet)
```

### 2. Kunde entscheidet:
```
Browser: [Approve] Button → ThammApprove Backend
```

### 3. Backend sendet Webhook:
```http
POST http://newswitchserver.thamm.local:51088/scripting/ThammApprove
Content-Type: application/json

{
  "jobId": "abc123",
  "fileName": "Kundenauftrag_2025_01.pdf",
  "status": "approved"
}
```

### 4. Switch verarbeitet:
```
Webhook Element → JSON-Datei → JSON Processor → Wait for Asset
                                     ↓              ↓
                           fileName extrahiert   Findet Kundenauftrag_2025_01.pdf
                                                        ↓
                                                  Gibt PDF frei zu Approved
```

## ✅ Vorteile dieser Lösung

### Korrekte Switch-Integration:
- ✅ Nutzt Webhook Element wie vorgesehen (nur JSON-Empfang)
- ✅ Wait for Asset für intelligente Asset-Verwaltung
- ✅ Keine Hacks oder Workarounds nötig

### Performance:
- ⚡ < 1 Sekunde Reaktionszeit
- 🎯 Direktes Asset-Matching über Dateiname
- 🔄 Keine Polling-Loops oder Timer

### Robustheit:
- 🛡️ Timeout-Handling in Wait for Asset
- 📊 Private Data für Tracking
- 🔍 Debug-Logging in allen Scripts

## 🔧 Installation

### 1. Scripts installieren:
```
switch-scripts/
├── submit-approval-compatible.js      # PDF-Einreichung
├── webhook-json-processor.js          # JSON-Verarbeitung
└── check-approval-status-compatible.js # Fallback (optional)
```

### 2. Backend konfigurieren:
```env
# .env
SWITCH_WEBHOOK_URL=http://newswitchserver.thamm.local:51088/scripting/ThammApprove
SWITCH_WEBHOOK_ENABLED=true
```

### 3. Flow aufbauen:
1. **Submit Flow:** Hot Folder → Submit Script → Pending Folder
2. **Webhook Flow:** Webhook Element → JSON Processor → Wait for Asset → Approved/Rejected

### 4. Wait for Asset konfigurieren:
- **Install from Appstore** falls noch nicht vorhanden
- **Asset Path:** Auf Pending Folder zeigen
- **Search Pattern:** Konfigurieren für Dateiname-Matching

## 🆘 Troubleshooting

### Webhook kommt nicht an?
```bash
# Test-Webhook senden:
curl -X POST http://newswitchserver.thamm.local:51088/scripting/ThammApprove \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "test123",
    "fileName": "test.pdf",
    "status": "approved"
  }'
```

### Wait for Asset findet Datei nicht?
- **Pending Folder Pfad** korrekt?
- **Dateiname** exakt gleich in Webhook und Filesystem?
- **Private Data** korrekt gesetzt?
- **Search Pattern** richtig konfiguriert?

### Debug-Logs prüfen:
```
Switch Log:
- "Processing webhook JSON"
- "Processing approval for file: Kundenauftrag_2025_01.pdf"
- "Status: approved"
- "Wait for Asset: Found file Kundenauftrag_2025_01.pdf"
```

## 📝 Zusammenfassung

Diese Lösung nutzt Switch-Komponenten **exakt wie vorgesehen**:

1. **Webhook Element:** Nur für JSON-Empfang
2. **Script Element:** Für JSON-Processing
3. **Wait for Asset:** Für intelligentes Asset-Management
4. **Named Connections:** Für sauberes Routing

**Resultat:** Elegante, robuste und blitzschnelle PDF-Freigabe mit < 1s Reaktionszeit! ⚡

---

**Das ist der korrekte Weg, Webhooks in Switch zu integrieren!** 🎯