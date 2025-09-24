# Flexible Connection-Zuordnung für Switch Scripts

## Das Problem mit Switch

Switch Scripts können **NICHT**:
- ❌ Namen von Verbindungen lesen
- ❌ Automatisch erkennen welche Connection wohin führt
- ❌ Dynamisch Verbindungen nach Namen zuordnen

## Die Lösung: Script Properties!

Ich habe eine **flexible Version** erstellt, die die Connection-Zuordnung über Script Properties macht:

### Neue Script-Datei:
✅ **check-approval-status-flexible.js**

## So funktioniert's:

### 1. Script Element Properties definieren:

Fügen Sie diese Properties im Script Element hinzu:

| Property Name | Typ | Default | Beschreibung |
|---------------|-----|---------|--------------|
| `apiUrl` | String | http://172.16.0.66:3101 | API Server URL |
| `checkInterval` | Number | 60 | Sekunden zwischen Checks |
| `maxWaitTime` | Number | 7200 | Max. Wartezeit in Sekunden |
| **`approvedConnection`** | **String** | **1** | **Connection für Approved** |
| **`rejectedConnection`** | **String** | **2** | **Connection für Rejected** |
| **`timeoutConnection`** | **String** | **3** | **Connection für Timeout** |
| **`pendingConnection`** | **String** | **success** | **Connection für Pending (Loop)** |

### 2. Verbindungen flexibel zuordnen:

**Beispiel 1: Standard-Setup**
```
approvedConnection = 1
rejectedConnection = 2
timeoutConnection = 3
pendingConnection = success
```

**Beispiel 2: Andere Reihenfolge**
```
approvedConnection = 3
rejectedConnection = 1
timeoutConnection = 2
pendingConnection = 4
```

**Beispiel 3: Mit Success/Error**
```
approvedConnection = 1
rejectedConnection = 2
timeoutConnection = error
pendingConnection = success
```

## Vorteile:

### ✅ Flexibel umkonfigurieren
- Verbindungen in beliebiger Reihenfolge ziehen
- Properties anpassen statt Script ändern
- Keine "Häkelei" mit Verbindungen

### ✅ Selbstdokumentierend
Script loggt welche Connection verwendet wird:
```
"Routing to APPROVED (Connection 1)"
"Routing to REJECTED (Connection 2)"
"Routing to PENDING (Connection success)"
```

### ✅ Mix aus Nummern und Level
- Kann Nummern verwenden: 1, 2, 3, 4...
- Kann Level verwenden: "success", "error"
- Gemischt möglich

## Setup in Switch:

### 1. Script Element erstellen
- Name: Check Approval Status Flexible
- Script: **check-approval-status-flexible.js**
- Anzahl Outputs: 3 (oder mehr)

### 2. Properties hinzufügen
Rechtsklick → Properties → Add:
- `approvedConnection` (String) = "1"
- `rejectedConnection` (String) = "2"
- `timeoutConnection` (String) = "3"
- `pendingConnection` (String) = "success"

### 3. Verbindungen ziehen (beliebige Reihenfolge!)
- Connection 1 → wohin Sie wollen
- Connection 2 → wohin Sie wollen
- Connection 3 → wohin Sie wollen
- Success → zurück zum Hold Job

### 4. Properties anpassen
Wenn Connection 1 jetzt Rejected sein soll:
- `approvedConnection` = "2"
- `rejectedConnection` = "1"

Fertig! Kein Script-Edit nötig!

## Workflow-Beispiel:

```
[Submit Script]
    ↓
[Hold Job (60s)] ← ─ ─ ─ ─ ─ ─ ┐
    ↓                           │
[Check Status Flexible]         │
    ├─→ Connection 1 ───────────┤ (Property: approvedConnection = 1)
    ├─→ Connection 2 ───────────┤ (Property: rejectedConnection = 2)
    ├─→ Connection 3 ───────────┤ (Property: timeoutConnection = 3)
    └─→ Success ────────────────┘ (Property: pendingConnection = success)
```

## Migration von alter Version:

**Alt (starr):**
- check-approval-status-compatible.js
- Feste Connection-Nummern im Code

**Neu (flexibel):**
- check-approval-status-flexible.js
- Connection-Nummern in Properties

## Tipp für Power-User:

Sie können sogar Connection-Namen simulieren mit Kommentaren:
```
approvedConnection = 1  // → "Approved_Folder"
rejectedConnection = 2  // → "Rejected_Folder"
timeoutConnection = 3   // → "Timeout_Folder"
pendingConnection = success // → "Hold_Job"
```

---

**Das ist die beste Lösung die Switch erlaubt - nicht perfekt, aber VIEL flexibler als hardcodierte Nummern!**