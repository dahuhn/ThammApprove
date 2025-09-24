# Webhook Setup Guide - Sofortige Benachrichtigung

## 🎯 Überblick

Statt alle 60 Sekunden zu pollen, sendet ThammApprove sofort einen Webhook an Switch wenn eine Freigabe erfolgt.

**Vorher:** PDF einreichen → 60s warten → Status prüfen → 60s warten → ...
**Nachher:** PDF einreichen → User genehmigt → **SOFORT** Switch Benachrichtigung ✨

## 🔧 Setup Schritte

### 1. Backend Konfiguration

**Datei:** `backend/.env`
```env
# Webhook zu Switch aktivieren
SWITCH_WEBHOOK_ENABLED=true
SWITCH_WEBHOOK_URL=http://newswitchserver.thamm.local:51088/scripting/ThammApprove
SWITCH_WEBHOOK_TIMEOUT=5000
SWITCH_WEBHOOK_MAX_RETRIES=3
```

**Endpoint-Konfiguration:**
- `newswitchserver.thamm.local` = Switch Server Hostname
- `51088` = Port des Switch Scripting Services
- `/scripting/ThammApprove` = Spezifischer ThammApprove Endpoint

### 2. Switch Flow Aufbau

#### Variante A: Reiner Webhook-Flow (Empfohlen)

```
[Hot Folder]
     │
     v
[Submit Script] ──Success──► [HTTP Server Element]
     │                           │
     v──Error──► [Error Folder]  │ (wartet passiv auf Webhook)
                                 │
                         ┌───────┴────────┐
                         │                │
                    "Approved"       "Rejected"
                         │                │
                         v                v
                 [Approved Folder]  [Rejected Folder]
```

#### Variante B: Hybrid-Flow (Ausfallsicher)

```
[Hot Folder]
     │
     v
[Submit Script] ──Success──► [HTTP Server Element] (Webhook, sofort)
     │                           │
     v──Success──► [Hold 300s] ──┴► [Check Status] (Polling, Fallback)
     │                                    │
     v──Error──► [Error Folder]          │
                                         │
                              ┌──────────┴─────────┐
                              │                    │
                         "Approved"           "Rejected"
                              │                    │
                              v                    v
                      [Approved Folder]    [Rejected Folder]
```

### 3. HTTP Server Element Konfiguration

**Element-Typ:** Webhook Element (aus Switch Appstore)

**Properties:**
```
Name: ThammApprove Webhook Receiver
Webhook Type: Incoming (Subscribe)
Port: 51088
Path: /scripting/ThammApprove
Method: POST
Content Type: application/json
Script: webhook-receiver-compatible.js
```

**Connections benennen:**
1. Rechtsklick auf Ausgang 1 → Properties → Name: "Approved"
2. Rechtsklick auf Ausgang 2 → Properties → Name: "Rejected"

### 4. Script Properties (webhook-receiver-compatible.js)

```
approvedFolderName = Approved     (Connection Name für Approved)
rejectedFolderName = Rejected     (Connection Name für Rejected)
```

## 🔗 Integration Points

### Backend → Switch Webhook

**Wann wird gesendet:**
- Sofort bei PDF-Genehmigung (approve button)
- Sofort bei PDF-Ablehnung (reject button)

**Payload Struktur:**
```json
{
  "jobId": "switch-job-12345",
  "status": "approved",
  "approvedBy": "max.mustermann@thamm.de",
  "approvedAt": "2025-01-15T14:30:00Z",
  "comments": "Sieht gut aus!",
  "token": "eyJ0eXAi..."
}
```

### Switch Webhook Handler

**Script:** `webhook-receiver-compatible.js`
**Funktion:** `webhookReceived(s, request)`

**Was passiert:**
1. Webhook-Payload parsen
2. Job anhand `jobId` in Switch finden
3. Private Data mit Approval-Details aktualisieren
4. Job an entsprechende Connection weiterleiten ("Approved"/"Rejected")

## 🧪 Testing

### 1. Backend Test-Endpoint

```bash
# Test ob Webhook-Service funktioniert:
curl http://172.16.0.66:3101/api/approvals/webhook/test

# Manual Webhook Test:
node tools/test-webhook.js --url http://newswitchserver.thamm.local:51088/scripting/ThammApprove
```

**Erwartete Antwort:**
```json
{
  "webhookTest": {
    "success": true,
    "message": "Switch responded with status 200"
  },
  "configuration": {
    "enabled": true,
    "url": "http://172.16.0.67:9090/webhook",
    "timeout": 5000,
    "maxRetries": 3
  }
}
```

### 2. Manual Webhook Test

```bash
# Test Tool verwenden:
cd ThammApprove/tools
node test-webhook.js --url http://newswitchserver.thamm.local:51088/scripting/ThammApprove --approved

# Oder manual mit curl:
curl -X POST http://newswitchserver.thamm.local:51088/scripting/ThammApprove \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "test-123",
    "status": "approved",
    "approvedBy": "Test User",
    "approvedAt": "2025-01-15T10:00:00Z"
  }'
```

### 3. End-to-End Test

1. **PDF in Hot Folder legen**
2. **Switch Log prüfen:** "Approval created with ID xyz"
3. **Im Browser PDF genehmigen**
4. **Switch Log sofort prüfen:** "Webhook received for job xyz"
5. **Job landet sofort in Approved Folder** ✅

## 🔧 Troubleshooting

### "Connection refused" Error

**Problem:** Switch HTTP Server nicht erreichbar

**Lösungen:**
- Webhook Element auf Switch Server aktiviert?
- Port 51088 frei und nicht durch Firewall blockiert?
- Hostname `newswitchserver.thamm.local` auflösbar?

```bash
# DNS-Auflösung testen:
nslookup newswitchserver.thamm.local

# Port-Verbindung testen:
telnet newswitchserver.thamm.local 51088

# HTTP-Endpoint testen:
curl -I http://newswitchserver.thamm.local:51088/scripting/ThammApprove
```

### "Job not found" Warning

**Problem:** Switch kann Job nicht zuordnen

**Ursachen:**
- `jobId` stimmt nicht überein
- Job bereits verarbeitet
- Private Data "ApprovalId" fehlt

**Debug:**
```javascript
// In webhook-receiver-compatible.js Debug aktivieren:
job.log(LogLevel.Debug, "Looking for job with ApprovalId: " + payload.jobId);
```

### Webhook kommt nicht an

**Problem:** Backend sendet, aber Switch empfängt nicht

**Prüfungen:**
1. **Backend Log:** "Webhook sent to Switch for job xyz"
2. **Network:** `ping newswitchserver.thamm.local`
3. **Port:** `telnet newswitchserver.thamm.local 51088`
4. **Switch Log:** Webhook Element Logs aktivieren

### Fallback auf Polling

Wenn Webhook fehlschlägt, fällt das System automatisch auf Polling zurück:

**Backend Log:**
```
⚠️ Webhook failed for job xyz, Switch will poll for status
```

**Switch:** Check-Status-Script läuft weiter und findet Status beim nächsten Poll.

## 📊 Performance Vergleich

### Polling (Alt)
- **Latenz:** 0-60 Sekunden (Durchschnitt: 30s)
- **CPU-Last:** Hoch (ständige API-Calls)
- **Netzwerk:** Hoch (alle 60s Request)
- **Skalierung:** Schlecht (n Jobs = n*60s API-Calls)

### Webhook (Neu)
- **Latenz:** < 1 Sekunde ✨
- **CPU-Last:** Minimal (nur bei Änderung)
- **Netzwerk:** Minimal (nur bei Approval)
- **Skalierung:** Exzellent (100 Jobs = 100 Webhooks)

## 🔒 Security Considerations

### Produktion

```env
# HTTPS verwenden (für Produktion):
SWITCH_WEBHOOK_URL=https://newswitchserver.thamm.local:51089/scripting/ThammApprove

# Webhook Secret (optional):
SWITCH_WEBHOOK_SECRET=your-secret-key

# Rate Limiting:
SWITCH_WEBHOOK_MAX_RETRIES=3
```

### Switch HTTP Server

```
SSL Certificate: Installiert
Authentication: Basic/Token (optional)
Rate Limiting: 10 req/min pro IP
```

## 🎯 Empfohlene Konfiguration

### Hybrid-Setup (Best Practice)

**Webhook:** Primärer Mechanismus für 99% der Fälle
**Polling:** Fallback mit 5-Minuten-Intervall

**Vorteile:**
- ✅ Sofortige Reaktion in Normalfall
- ✅ Ausfallsicher bei Netzwerk-Problemen
- ✅ Keine Lost-Updates möglich
- ✅ Skaliert mit Last

**Flow:**
```
[Submit] → [HTTP Server (Webhook)] ← Sofort bei Approval
     |
     v
[Hold 300s] → [Check Status] ← Fallback alle 5 Minuten
```

Mit diesem Setup bekommst du die Eleganz von Webhooks mit der Robustheit von Polling! 🚀