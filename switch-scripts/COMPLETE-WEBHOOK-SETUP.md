# Komplettes Webhook Setup - PDF bleibt in Switch

## 🎯 Überblick

**Das Konzept:** PDF verlässt Switch nie! Es wartet im Hold Element bis der Webhook das OK gibt.

```
PDF → Submit → Hold (warten) → Webhook empfangen → Job freigeben → Approved/Rejected
```

## 🔧 Kompletter Switch Flow

### Flow-Aufbau:

```
[Hot Folder] → [Submit Script] ──Success──► [Hold Element] ──► [Approved Folder]
                     │                           │                     ↗
                     │                           │               "Approved"
                     │                           │                    ↗
                     │                           │    [Webhook Element]
                     │                           │           ↗
                     │                           │    HTTP Callback
                     │                           │         ↗
                     v──Error──► [Error Folder]   └─ PDF wartet hier!
                                                          ↘
                                                      "Rejected"
                                                           ↘
                                                    [Rejected Folder]
```

### 1. Submit Script Element

**Script:** `submit-approval-compatible.js` (unverändert)
**Verbindungen:**
- Success → Hold Element
- Error → Error Folder

**Aufgabe:** PDF hochladen, ApprovalId setzen, PDF an Hold Element weiterleiten

### 2. Hold Element (NEU!)

**Element-Typ:** Hold Job
**Properties:**
```
Name: ThammApprove Hold
Release Mode: Manual
Hold Time: Unlimited (oder 7200s als Fallback)
Maximum Jobs: 1000
```

**Verbindungen:**
- Ausgang 1 → Name: "Approved" → Approved Folder
- Ausgang 2 → Name: "Rejected" → Rejected Folder

**Aufgabe:** PDFs sammeln und auf Webhook-Release warten

### 3. Webhook Element

**Element-Typ:** Webhook (aus Switch Appstore)
**Properties:**
```
Name: ThammApprove Webhook Receiver
Webhook Type: Incoming (Subscribe)
Port: 51088
Path: /scripting/ThammApprove
Method: POST
Content Type: application/json
Script: webhook-receiver-hold-release.js
```

**Verbindungen:**
- ⚠️ **Wichtig:** Webhook Element hat KEINEN Ausgang zu Ordnern!
- Das Script macht job.release() und routet direkt

### 4. End-Ordner

**Approved Folder:** `/approved/`
**Rejected Folder:** `/rejected/`
**Error Folder:** `/error/`

## 📜 Script-Details

### submit-approval-compatible.js
**Unverändert** - leitet PDF an Hold Element weiter:
```javascript
routeByName(s, job, successName, scriptName); // successName = "Success" → Hold Element
```

### webhook-receiver-hold-release.js (NEU!)
**Key Functions:**
```javascript
function webhookReceived(s, request) {
    // 1. Webhook parsen
    var payload = JSON.parse(request.body);

    // 2. Job im Hold Element finden
    var job = s.findJobByPrivateData("ApprovalId", payload.jobId);

    // 3. Job aus Hold freigeben
    job.release();

    // 4. Private Data aktualisieren
    job.setPrivateData("ApprovalStatus", payload.status);

    // 5. Job zur richtigen Connection routen
    if (payload.status === 'approved') {
        routeJobToConnection(s, job, "Approved", scriptName);
    } else {
        routeJobToConnection(s, job, "Rejected", scriptName);
    }
}
```

## 🔗 Job-Routing Mechanismus

### Problem: Webhook Element hat nur einen Ausgang
**Lösung:** Script findet Job und routet ihn direkt!

```javascript
function routeJobToConnection(s, job, targetName, scriptName) {
    // Job direkt an benannte Connection des Hold Elements senden
    // NICHT an Webhook Element Connections!

    var numConnections = job.getElement().getOutgoingConnectionCount();
    for (var i = 1; i <= numConnections; i++) {
        var connectionName = job.getElement().getOutgoingName(i);
        if (connectionName.toLowerCase() === targetName.toLowerCase()) {
            job.sendToData(i);
            return;
        }
    }
}
```

### Wichtiger Punkt:
Das Script routet Jobs **VOM HOLD ELEMENT** (wo sie warten), **NICHT vom Webhook Element**!

## ⚙️ Konfiguration

### Backend (.env):
```env
SWITCH_WEBHOOK_ENABLED=true
SWITCH_WEBHOOK_URL=http://newswitchserver.thamm.local:51088/scripting/ThammApprove
SWITCH_WEBHOOK_TIMEOUT=5000
SWITCH_WEBHOOK_MAX_RETRIES=3
```

### Switch Element Properties:

#### Submit Script:
```
successName = Success  (→ Hold Element)
errorName = Error      (→ Error Folder)
```

#### Hold Element:
```
Release Mode = Manual
Hold Time = 7200       (2h Fallback)
```

#### Webhook Element:
```
Port = 51088
Path = /scripting/ThammApprove
Script = webhook-receiver-hold-release.js
```

## 🧪 Testing

### 1. Flow testen:
```bash
# 1. PDF in Hot Folder legen
# 2. Switch Log: "Approval created with ID xyz"
# 3. Job sollte in Hold Element warten
# 4. Im Browser PDF genehmigen
# 5. Switch Log: "Webhook received for job xyz"
# 6. Switch Log: "Job released from Hold Element"
# 7. PDF landet in Approved Folder ✅
```

### 2. Webhook direkt testen:
```bash
cd ThammApprove/tools
node test-webhook.js --url http://newswitchserver.thamm.local:51088/scripting/ThammApprove --approved
```

### 3. Hold Element Status prüfen:
```
Switch Designer → Hold Element → rechts-click → Job Queue
→ Sollte wartende Jobs anzeigen
```

## 🔍 Troubleshooting

### "Job not found" Fehler:
**Ursachen:**
- Job bereits durch Timeout freigegeben
- ApprovalId stimmt nicht überein
- Job ist nicht im Hold Element

**Debug:**
```javascript
// In webhook-receiver-hold-release.js:
s.log(LogLevel.Debug, "Looking for job with ApprovalId: " + payload.jobId);
var allJobs = s.getAllJobs(); // Alle Jobs auflisten
```

### Jobs hängen im Hold Element:
**Ursachen:**
- Webhook kommt nicht an
- job.release() funktioniert nicht
- Routing-Problem

**Lösungen:**
- Hold Element Fallback-Timer aktivieren (2h)
- Manual Release in Switch Designer testen
- Log-Level auf Debug setzen

### Webhook kommt an, aber Job wird nicht geroutet:
**Ursachen:**
- Connection-Namen stimmen nicht
- job.release() failed
- Routing-Logic Fehler

**Debug:**
```javascript
// Job-State vor und nach Release loggen:
s.log(LogLevel.Info, "Job state before release: " + job.getState());
var released = job.release();
s.log(LogLevel.Info, "Release successful: " + released);
s.log(LogLevel.Info, "Job state after release: " + job.getState());
```

## 📊 Workflow-Timing

### Normaler Ablauf:
```
0s:     PDF → Submit → Hold (PDF wartet)
???:    User approves in Browser
<1s:    Webhook → job.release() → Approved Folder ✅
```

### Mit Fallback:
```
0s:     PDF → Submit → Hold (PDF wartet)
7200s:  Hold Timeout → Connection 1 (Approved als Fallback)
```

## 🎯 Vorteile dieses Setups

✅ **PDF verlässt Switch nie** - keine Upload/Download-Delays
✅ **Sofortige Reaktion** bei Webhook (< 1s)
✅ **Ausfallsicher** durch Hold Element Timeout
✅ **Skalierbar** - hunderte PDFs können gleichzeitig warten
✅ **Nachverfolgbar** - jeder Job hat eindeutige ApprovalId
✅ **Robust** - funktioniert auch wenn Webhook fehlschlägt

## 🚀 Nächste Schritte

1. **Hold Element** in Flow einfügen und konfigurieren
2. **webhook-receiver-hold-release.js** als Script laden
3. **Connection-Namen** am Hold Element setzen ("Approved", "Rejected")
4. **Backend** mit neuer Webhook-URL starten
5. **End-to-End Test** durchführen

Das ist die perfekte Lösung - PDFs bleiben in Switch, warten geduldig, und werden sofort geroutet wenn die Entscheidung da ist! 🎯