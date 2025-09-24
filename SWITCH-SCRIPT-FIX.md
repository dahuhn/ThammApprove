# Switch Script Kompatibilitätsproblem behoben

## Problem
Switch-Parser-Fehler in Zeile 4: `Parse Error: expecting 'error' or ',' or ';'`

**Ursache:** Switch unterstützt kein modernes JavaScript (ES6+):
- Kein `async/await`
- Kein `const/let` (nur `var`)
- Andere Syntax-Unterschiede

## Lösung
✅ **Switch-kompatible Versionen erstellt:**

### Neue Dateien:
- `submit-approval-compatible.js` - Switch-kompatible Version
- `check-approval-status-compatible.js` - Switch-kompatible Version

### Hauptunterschiede:

**Alt (ES6+):**
```javascript
async function jobArrived(s, job) {
    const scriptName = "ThammApprove Status Check";
    const apiUrl = await s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
    const response = await axios.get(url);
}
```

**Neu (Switch-kompatibel):**
```javascript
function jobArrived(s, job) {
    var scriptName = "ThammApprove Status Check";
    var apiUrl = s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";

    var http = new HTTP();
    http.get(url, function(response) {
        // Callback-basiert statt async/await
    });
}
```

## In Switch verwenden:

### 1. Alte Scripts ersetzen:
- ❌ `submit-approval.js`
- ❌ `check-approval-status.js`

### 2. Neue Scripts nutzen:
- ✅ `submit-approval-compatible.js`
- ✅ `check-approval-status-compatible.js`

### 3. Flow-Element konfigurieren:

**Script-Datei auswählen:**
- `submit-approval-compatible.js`

**Properties:**
- `apiUrl`: http://172.16.0.66:3101
- `customerEmail`: kunde@firma.de
- `customerName`: Kunde Name (optional)

## Features beibehalten:

✅ **Alle Funktionen funktionieren weiterhin:**
- PDF-Upload an ThammApprove
- Status-Checking mit Polling
- Private Data Integration
- Error Handling
- Timeout-Behandlung
- E-Mail Benachrichtigungen

## Verbindungen (Connections):

**Submit Script:**
- Success: PDF wurde eingereicht
- Error: Fehler beim Einreichen

**Check Status Script:**
- 1: Approved (Freigegeben)
- 2: Rejected (Abgelehnt)
- 3: Timeout (Zeit abgelaufen)
- Success: Pending (noch wartend - Loop)

---

**Die Switch-Scripts sind jetzt kompatibel und einsatzbereit! 🔧**