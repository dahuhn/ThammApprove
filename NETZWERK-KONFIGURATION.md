# ThammApprove - Netzwerk-Konfiguration

## ✅ System für Netzwerk-Zugriff konfiguriert!

**Deine IP-Adresse:** `172.16.0.66`

## Was wurde geändert:

### Backend (API Server)
- ✅ **Bind-Adresse:** `0.0.0.0` (alle Netzwerk-Interfaces)
- ✅ **CORS:** Erlaubt Zugriff von `172.16.0.66:3100`
- ✅ **Frontend URL:** `http://172.16.0.66:3100` für E-Mail-Links

### Frontend (Web-Interface)
- ✅ **Host:** `0.0.0.0` (alle Netzwerk-Interfaces)
- ✅ **API URL:** `http://172.16.0.66:3101`

### Switch Scripts
- ✅ **Standard API URL:** `http://172.16.0.66:3101`

## Neue URLs:

### Für Benutzer (Kunden):
```
Frontend: http://172.16.0.66:3100
```

### Für Switch-Server:
```
API: http://172.16.0.66:3101
Health Check: http://172.16.0.66:3101/health
```

## System neu starten:

1. **Backend stoppen:** `Strg + C` im Backend-Terminal
2. **Frontend stoppen:** `Strg + C` im Frontend-Terminal
3. **Backend starten:** `npm run dev` (im backend Ordner)
4. **Frontend starten:** `npm start` (im frontend Ordner)

## Firewall prüfen:

**Windows Firewall** könnte die Ports blockieren. Falls andere Rechner nicht zugreifen können:

1. Windows-Taste + R → `wf.msc` eingeben
2. "Eingehende Regeln" → "Neue Regel"
3. Port-Regel für 3100 und 3101 erstellen
4. Verbindung zulassen

## Switch-Integration:

### Auf deinem Switch-Server:

**Submit Approval Script Properties:**
```
apiUrl = http://172.16.0.66:3101
customerEmail = kunde@firma.de
customerName = Kunde Name
```

**Check Status Script Properties:**
```
apiUrl = http://172.16.0.66:3101
checkInterval = 60
maxWaitTime = 7200
```

## E-Mail Links:

Kunden erhalten jetzt E-Mails mit Links wie:
```
http://172.16.0.66:3100/approve/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Test vom anderen Rechner:

**Vom Switch-Server aus testen:**

1. Browser öffnen: `http://172.16.0.66:3100`
2. API testen: `http://172.16.0.66:3101/health`

**Mit curl testen:**
```bash
curl http://172.16.0.66:3101/health
```

## Backup der alten localhost-Konfiguration:

Falls du zurück zu localhost-only willst:

### Backend (.env):
```
FRONTEND_URL=http://localhost:3100
```

### Frontend (.env):
```
REACT_APP_API_URL=http://localhost:3101
```

### Backend (index.ts):
```javascript
app.listen(PORT, 'localhost', () => {
```

---

**Das System ist jetzt über das Netzwerk erreichbar! 🌐**