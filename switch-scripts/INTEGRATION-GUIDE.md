# ThammApprove Switch Scripts Integration Guide

## Übersicht der Script-Versionen

### 1. Named Connection Scripts (Empfohlen)
Diese Scripts nutzen Connection-NAMEN statt Nummern. Das macht die Workflows flexibler und leichter wartbar.

**Vorteile:**
- Connections können umbenannt werden, ohne Scripts anzupassen
- Selbstdokumentierend durch sprechende Namen
- Flexibler bei Workflow-Änderungen

**Dateien:**
- `check-approval-status-named.js` - Status-Prüfung mit Named Connections
- `submit-approval-named.js` - Einreichung mit Named Connections
- `webhook-receiver-named.js` - Webhook-Empfang mit Named Connections

### 2. Compatible Scripts (Legacy/Fallback)
Diese Scripts nutzen feste Connection-Nummern für maximale Kompatibilität mit älteren Switch-Versionen.

**Vorteile:**
- Funktioniert mit allen Switch-Versionen
- Einfache, direkte Implementierung
- Keine erweiterten Features nötig

**Dateien:**
- `check-approval-status-compatible.js` - Status-Prüfung mit festen Nummern
- `submit-approval-compatible.js` - Einreichung mit festen Nummern
- `webhook-receiver.js` - Standard Webhook-Empfang

### 3. Flexible Scripts (In Entwicklung)
Hybride Lösung, die sowohl Named als auch nummerierte Connections unterstützt.

## Connection-Schema

### Named Connections Setup

#### Submit Script Connections:
- **Success** → Weiterleitung nach erfolgreicher Einreichung
- **Error** → Fehlerbehandlung

#### Check Status Script Connections:
- **Approved** → Genehmigte Jobs
- **Rejected** → Abgelehnte Jobs
- **Timeout** → Zeitüberschreitung
- **Pending** → Noch wartend (Loop zurück)

#### Webhook Script Connections:
- **Approved** → Ordner für genehmigte Jobs
- **Rejected** → Ordner für abgelehnte Jobs

### Compatible Scripts Connection-Nummern:

#### Submit Script:
- Connection.Level.Success → Erfolg
- Connection.Level.Error → Fehler

#### Check Status Script:
- Connection 1 → Approved
- Connection 2 → Rejected
- Connection 3 → Timeout
- Connection.Level.Success → Pending (Loop)

## Konfiguration in Switch

### Properties für Named Connection Scripts:

```javascript
// In Switch Script Element Properties definieren:
apiUrl: "http://172.16.0.66:3101"
checkInterval: 60  // Sekunden
maxWaitTime: 7200  // Sekunden (2 Stunden)

// Connection Namen (optional, falls abweichend):
approvedName: "Approved"
rejectedName: "Rejected"
timeoutName: "Timeout"
pendingName: "Pending"
successName: "Success"
errorName: "Error"
```

### Properties für Compatible Scripts:

```javascript
// In Switch Script Element Properties definieren:
apiUrl: "http://172.16.0.66:3101"
checkInterval: 60  // Sekunden
maxWaitTime: 7200  // Sekunden (2 Stunden)
```

## Workflow-Aufbau

### Empfohlener Workflow mit Named Connections:

```
[Hot Folder]
     |
     v
[Submit Approval (Named)]
     |
     v--Success-->
[Hold Job (60s)]
     |
     v
[Check Status (Named)]
     |
     |--Approved--> [Approved Folder]
     |--Rejected--> [Rejected Folder]
     |--Timeout---> [Timeout Folder]
     |--Pending---> (Loop zurück zu Hold Job)
```

### Connections benennen:

1. Im Switch Designer die Verbindungen vom Check Status Element anlegen
2. Rechtsklick auf jede Connection → Properties
3. Namen vergeben: "Approved", "Rejected", "Timeout", "Pending"

## Migration von Compatible zu Named

1. **Scripts austauschen:**
   - `check-approval-status-compatible.js` → `check-approval-status-named.js`
   - `submit-approval-compatible.js` → `submit-approval-named.js`

2. **Connections benennen:**
   - Connection 1 → "Approved"
   - Connection 2 → "Rejected"
   - Connection 3 → "Timeout"
   - Success Connection → "Pending"

3. **Properties anpassen (optional):**
   - Fügen Sie Connection-Namen-Properties hinzu, falls abweichend

## Fehlerbehandlung

### Named Scripts Fallback-Logik:

1. Sucht zuerst nach Connection mit passendem Namen
2. Prüft spezielle Connection-Namen (Success, Error)
3. Versucht Namen als Nummer zu interpretieren
4. Ultimativer Fallback: Success Connection

### Debug-Logging:

Die Named Scripts loggen ausführlich:
- Welche Connections gesucht werden
- Welche Namen gefunden wurden
- Wohin geroutet wird

Aktivieren Sie Debug-Level in Switch für detaillierte Logs.

## Testing

### Test-Szenarios:

1. **Happy Path:** PDF einreichen → Genehmigen → Approved Folder
2. **Rejection:** PDF einreichen → Ablehnen → Rejected Folder
3. **Timeout:** Max. Wartezeit überschreiten → Timeout Folder
4. **Connection Fallback:** Connection umbenennen → Script findet trotzdem

### Webhook-Testing:

```bash
# Test Approved Webhook
curl -X POST http://localhost:9090/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "test-123",
    "status": "approved",
    "approvedBy": "Test User",
    "approvedAt": "2024-01-15T10:00:00Z"
  }'
```

## Troubleshooting

### "Connection not found" Fehler:
- Prüfen Sie die Connection-Namen in Switch
- Achten Sie auf Groß-/Kleinschreibung
- Überprüfen Sie Leerzeichen am Anfang/Ende

### Jobs bleiben in Pending:
- API-Erreichbarkeit prüfen
- Check Interval zu kurz? (Standard: 60s)
- Max Wait Time erreicht? (Standard: 2h)

### Webhook kommt nicht an:
- Firewall/Port-Freigabe prüfen
- Webhook-URL in ThammApprove korrekt?
- Switch HTTP Server Element aktiv?