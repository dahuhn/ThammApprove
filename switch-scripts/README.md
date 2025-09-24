# Enfocus Switch Scripts für ThammApprove

Diese Scripts integrieren das ThammApprove PDF-Approval-System in Enfocus Switch Workflows.

## ⚠️ WICHTIGE HINWEISE

**Verwenden Sie DIESE Scripts (Switch-kompatibel, mit Named Connections):**
- ✅ **submit-approval-compatible.js** (mit Named Connection Support)
- ✅ **check-approval-status-compatible.js** (mit Named Connection Support)
- ✅ **webhook-receiver-compatible.js** (NEU - mit Named Connection Support)

**NICHT diese Scripts verwenden:**
- ❌ ~~submit-approval.js~~ (enthält modernes JavaScript)
- ❌ ~~check-approval-status.js~~ (enthält modernes JavaScript)
- ❌ ~~*-named.js~~ (moderne JS-Syntax, funktioniert nicht in Switch)

## Scripts

### 1. submit-approval-compatible.js
Sendet PDFs zur Freigabe an das ThammApprove System.

**Flow-Element:** Script Element
**Verbindungen (Named Connections):**
- "Success": PDF wurde erfolgreich zur Freigabe eingereicht
- "Error": Fehler beim Einreichen

**Properties:**
- `apiUrl`: URL des ThammApprove Servers (default: http://172.16.0.66:3101)
- `customerEmail`: E-Mail des Kunden (kann aus Private Data kommen)
- `customerName`: Name des Kunden (optional)
- `notificationEmail`: E-Mail für interne Benachrichtigungen (optional)
- `successName`: Name der Success-Connection (default: "Success")
- `errorName`: Name der Error-Connection (default: "Error")

### 2. check-approval-status-compatible.js
Prüft den Status einer ausstehenden Freigabe.

**Flow-Element:** Script Element mit Timer/Loop
**Verbindungen (Named Connections):**
- "Approved": PDF wurde freigegeben
- "Rejected": PDF wurde abgelehnt
- "Timeout": Maximale Wartezeit überschritten
- "Pending": Noch ausstehend (Loop)

**Properties:**
- `apiUrl`: URL des ThammApprove Servers (default: http://172.16.0.66:3101)
- `checkInterval`: Prüfintervall in Sekunden (default: 60)
- `maxWaitTime`: Maximale Wartezeit in Sekunden (default: 7200 = 2 Stunden)
- `approvedName`: Name der Approved-Connection (default: "Approved")
- `rejectedName`: Name der Rejected-Connection (default: "Rejected")
- `timeoutName`: Name der Timeout-Connection (default: "Timeout")
- `pendingName`: Name der Pending-Connection (default: "Pending")

### 3. webhook-receiver-compatible.js
Empfängt Webhook-Callbacks vom Approval-System für sofortige Updates.

**Flow-Element:** HTTP Server oder WebServices
**Endpoint:** `/webhook/approval`
**Verbindungen (Named Connections):**
- "Approved": Für genehmigte Jobs
- "Rejected": Für abgelehnte Jobs

**Properties:**
- `approvedFolderName`: Name der Approved-Connection/Folder (default: "Approved")
- `rejectedFolderName`: Name der Rejected-Connection/Folder (default: "Rejected")

## Beispiel-Workflow mit Named Connections

```
[Hot Folder]
    ↓
[Submit Approval Script]
    ├─Success─→ [Hold Job Element (60s)]
    └─Error───→ [Error Folder]
                      ↓
                [Check Status Script]
                ├─Approved─→ [Approved Folder] → [Weitere Verarbeitung]
                ├─Rejected─→ [Rejected Folder] → [Benachrichtigung]
                ├─Timeout──→ [Timeout Folder] → [Manuelle Prüfung]
                └─Pending──→ [Loop zurück zu Hold Job]
```

### Connection-Setup:
1. **Submit Script Connections:**
   - Rechtsklick auf Success-Connection → Properties → Name: "Success"
   - Rechtsklick auf Error-Connection → Properties → Name: "Error"

2. **Check Status Script Connections:**
   - Connection 1 → Properties → Name: "Approved"
   - Connection 2 → Properties → Name: "Rejected"
   - Connection 3 → Properties → Name: "Timeout"
   - Success-Connection → Properties → Name: "Pending" (für Loop)

## Installation

1. **NUR die kompatiblen Scripts kopieren:**
   - ✅ `submit-approval-compatible.js`
   - ✅ `check-approval-status-compatible.js`
   - ✅ `webhook-receiver-compatible.js` (NEU)
   - ❌ NICHT die anderen *.js Dateien!

2. **Keine externen Node.js Module nötig!**
   - Die kompatiblen Scripts verwenden nur Switch-native APIs
   - ❌ ~~npm install axios form-data xml2js~~ (nicht mehr nötig)

3. **Flow-Elemente konfigurieren:**
   - Script Element für Submit und Check
   - Hold Job Element für Polling-Intervall (60-300 Sekunden)
   - HTTP Server für Webhooks (optional)

4. **Named Connections einrichten:**
   - Connections anlegen und benennen (z.B. "Approved", "Rejected")
   - Rechtsklick auf Connection → Properties → Name vergeben
   - Fallback: Scripts funktionieren auch mit Nummern (1=Approved, 2=Rejected, etc.)

## Private Data Felder

Die Scripts verwenden folgende Private Data Felder:

### Gesetzt von submit-approval-compatible.js:
- `ApprovalId`: Eindeutige ID der Freigabe
- `ApprovalToken`: Token für direkten Zugriff
- `ApprovalStatus`: pending/approved/rejected
- `ApprovalSubmitTime`: Zeitstempel der Einreichung

### Gesetzt von check-approval-status-compatible.js:
- `ApprovalLastCheck`: Letzter Check-Zeitstempel
- `ApprovedBy`: Name des Freigebenden
- `ApprovedAt`: Freigabe-Zeitstempel
- `ApprovalComments`: Kommentare zur Freigabe
- `RejectedReason`: Ablehnungsgrund
- `RejectionComments`: Kommentare zur Ablehnung

## Fehlerbehandlung

- Bei Netzwerkfehlern bleiben Jobs in der Warteschleife
- Timeout nach konfigurierter maxWaitTime
- Alle Fehler werden im Switch Log protokolliert
- Jobs mit Fehlern werden an Error-Verbindung gesendet

## Tipps

1. **Performance:** Verwenden Sie Webhooks statt Polling für sofortige Updates
2. **Sicherheit:** Verwenden Sie HTTPS in Produktion (ändern Sie IP zu HTTPS-URL)
3. **Monitoring:** Überwachen Sie das Hold Job Element auf hängende Jobs
4. **Backup:** Speichern Sie Approval-IDs in Metadata für Recovery
5. **Netzwerk:** System läuft auf IP `172.16.0.66` - von Switch-Server erreichbar
6. **Named Connections:** Verwenden Sie sprechende Namen für bessere Workflow-Dokumentation
7. **Migration:** Bestehende Workflows funktionieren weiter - Named Connections sind rückwärtskompatibel

## Unterschiede zu ursprünglichen Scripts

**Kompatible Versionen verwenden:**
- `var` statt `const/let`
- Switch-native `HTTP()` statt `axios`
- Switch-native `FormData()` statt externes Modul
- Callback-basiert statt `async/await`
- Keine externen NPM-Dependencies
- ES5-kompatibles Trim: `replace(/^\s+|\s+$/g, '')` statt `.trim()`

**Neue Features in kompatiblen Versionen:**
- ✅ **Named Connection Support** - Connections per Name statt Nummer
- ✅ **Fallback-Logik** - Funktioniert auch mit alten nummerierten Connections
- ✅ **Debug-Logging** - Zeigt welche Connections gefunden werden
- ✅ **Flexible Konfiguration** - Connection-Namen in Properties definierbar

**Alle bisherigen Funktionen bleiben identisch:**
- ✅ PDF-Upload
- ✅ Status-Polling
- ✅ Private Data Integration
- ✅ Fehlerbehandlung
- ✅ Timeout-Management