# Switch Script Connections - Wie funktioniert das Routing?

## Die Antwort: Connection-Nummern!

Switch Scripts routen Jobs **NICHT** nach:
- ❌ Namen der Verbindungen
- ❌ Typ der Verbindungen (Bewegen/Filter/Ampel)
- ❌ Namen der Ziel-Ordner

Sondern nach:
- ✅ **Connection-Nummern** (1, 2, 3, ...) oder
- ✅ **Connection-Level** (Success, Error)

## Wie funktioniert das im Script?

### Im Check Status Script:

```javascript
if (approval.status === 'approved') {
    job.sendToData(1);  // Sendet an Connection 1
} else if (approval.status === 'rejected') {
    job.sendToData(2);  // Sendet an Connection 2
} else if (timeout) {
    job.sendToData(3);  // Sendet an Connection 3
} else {
    job.sendToData(Connection.Level.Success); // Sendet an Success-Connection
}
```

## In Switch konfigurieren:

### Script Element Properties:

**Anzahl der Output-Verbindungen:** 3 (oder mehr)

### Verbindungen zuordnen:

```
[Check Status Script]
    ├─→ Connection 1 → [Approved Folder]
    ├─→ Connection 2 → [Rejected Folder]
    ├─→ Connection 3 → [Timeout Folder]
    └─→ Success      → [Hold Job] (zurück zur Schleife)
```

## WICHTIG: Die Reihenfolge!

**Connection 1** = **Erste** Verbindung die Sie ziehen
**Connection 2** = **Zweite** Verbindung die Sie ziehen
**Connection 3** = **Dritte** Verbindung die Sie ziehen
**Success** = Standard-Success-Verbindung (grün)
**Error** = Standard-Error-Verbindung (rot)

## Verbindungstypen in Switch:

### Typ ist EGAL für das Script!
- ✅ Kann "Bewegen" sein
- ✅ Kann "Filter" sein
- ✅ Kann "Ampel" sein
- ✅ Kann gemischt sein

Das Script sendet nur an die **Nummer**, Switch entscheidet dann was passiert.

## Praktisches Beispiel:

### 1. Script Element konfigurieren:
- **Name:** Check Approval Status
- **Script:** check-approval-status-compatible.js
- **Anzahl Outputs:** 3

### 2. Verbindungen ziehen (in DIESER Reihenfolge!):

1. **Erste Verbindung** (Connection 1):
   - Vom Script zu "Approved Folder"
   - Typ: Bewegen (oder was Sie wollen)

2. **Zweite Verbindung** (Connection 2):
   - Vom Script zu "Rejected Folder"
   - Typ: Bewegen

3. **Dritte Verbindung** (Connection 3):
   - Vom Script zu "Timeout Folder"
   - Typ: Bewegen

4. **Success-Verbindung** (grün):
   - Vom Script zurück zum Hold Job
   - Typ: Bewegen (für Loop)

## Code-Referenz aus dem Script:

```javascript
// check-approval-status-compatible.js

if (approval.status === 'approved') {
    // Send to approved connection
    job.sendToData(1); // Connection 1 = Approved

} else if (approval.status === 'rejected') {
    // Send to rejected connection
    job.sendToData(2); // Connection 2 = Rejected

} else if (timeout) {
    // Send to timeout connection
    job.sendToData(3); // Connection 3 = Timeout

} else {
    // Still pending - stay in loop
    job.sendToData(Connection.Level.Success); // Success = Back to Hold Job
}
```

## Häufige Probleme:

### Problem 1: Falsche Reihenfolge
**Symptom:** Approved Jobs landen im Rejected Folder
**Lösung:** Verbindungen in richtiger Reihenfolge neu ziehen

### Problem 2: Zu wenige Connections
**Symptom:** Script Error "Connection 3 not found"
**Lösung:** Script Element Properties → Anzahl Outputs erhöhen

### Problem 3: Verwechslung Success/Error
**Symptom:** Jobs verschwinden oder landen im Error-Ordner
**Lösung:** `Connection.Level.Success` statt Nummer verwenden

## Alternativen:

### Nur Success/Error verwenden:
Einfacheres Script mit nur 2 Ausgängen:
```javascript
if (approval.status === 'approved' || approval.status === 'rejected') {
    job.sendToData(Connection.Level.Success); // Fertig
} else {
    job.sendToData(Connection.Level.Error); // Problem
}
```

Dann müssen Sie nach dem Script einen Filter einbauen der nach Private Data filtert.

## Tipp für Debugging:

Im Script loggen welche Connection verwendet wird:
```javascript
job.log(LogLevel.Info, "Sending to connection: 1 (Approved)");
job.sendToData(1);
```

---

**Merke:** Das Script kennt nur Nummern (1,2,3) oder Level (Success/Error). Was Switch damit macht, bestimmen Sie durch die Verbindungen!