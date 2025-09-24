# ThammApprove - Benutzer-Anleitung

## System ist jetzt bereit! 🎉

**Status-Check:**
- ✅ Backend läuft auf: http://localhost:3101
- ✅ Frontend läuft auf: http://localhost:3100

## So benutzt du das System:

### Test 1: Basis-Funktionalität testen

1. **Öffne den Browser** und gehe zu: http://localhost:3100
2. Du solltest die **ThammApprove Willkommensseite** sehen

### Test 2: API testen

1. Öffne: http://localhost:3101/health
2. Du solltest sehen: `{"status":"ok","timestamp":"..."}`

### Test 3: PDF-Freigabe simulieren (manuell)

Da wir noch kein Switch haben, kannst du das System mit **Postman** oder **curl** testen:

#### PDF hochladen (Beispiel mit curl):
```bash
curl -X POST http://localhost:3101/api/approvals/create \
  -F "pdf=@C:/path/to/your/test.pdf" \
  -F "jobId=TEST001" \
  -F "customerEmail=test@example.com" \
  -F "customerName=Test Customer"
```

#### Oder mit einem Webtool:
1. Gehe zu: https://reqbin.com/
2. POST Request zu: `http://localhost:3101/api/approvals/create`
3. Form-data hinzufügen:
   - `pdf`: [PDF-Datei auswählen]
   - `jobId`: TEST001
   - `customerEmail`: deine-email@example.com
   - `customerName`: Test User

## Enfocus Switch Integration

### Switch Setup:

1. **Script installieren:**
   - Kopiere die Dateien aus `switch-scripts/` in dein Switch Script Repository

2. **Flow erstellen:**
   ```
   [Hot Folder] → [Submit Approval Script] → [Timer 60s] → [Check Status Script]
                                                ↓
                                        [Approved] / [Rejected] / [Timeout]
   ```

3. **Script Properties setzen:**

   **Submit Approval Script:**
   - `apiUrl`: http://localhost:3101
   - `customerEmail`: kunde@firma.de
   - `customerName`: Kunde Name (optional)

   **Check Status Script:**
   - `apiUrl`: http://localhost:3101
   - `checkInterval`: 60 (Sekunden)
   - `maxWaitTime`: 7200 (2 Stunden)

### Switch Flow Beispiel:

```
[Hot Folder: C:\Switch\Input]
    ↓
[Submit Approval Script]
    ↓ (Success)
[Hold Folder mit Timer: 60s]
    ↓
[Check Status Script]
    ├─→ Connection 1: [Approved Folder] → Weiterverarbeitung
    ├─→ Connection 2: [Rejected Folder] → Korrektur
    ├─→ Connection 3: [Timeout Folder] → Manuelle Prüfung
    └─→ Success: Zurück zu Hold (Loop)
```

## Typischer Workflow:

### 1. PDF kommt in Switch an
- Switch führt Submit Approval Script aus
- PDF wird an ThammApprove gesendet
- E-Mail geht an Kunden raus

### 2. Kunde erhält E-Mail
- Klickt auf Link in der E-Mail
- Sieht PDF im Browser
- Kann freigeben oder ablehnen

### 3. Nach Freigabe/Ablehnung
- Switch Check Status Script erkennt die Änderung
- Job wird an entsprechende Verbindung gesendet
- Workflow kann fortgesetzt werden

## E-Mail Konfiguration (für echte E-Mails)

Bearbeite: `C:\Users\dhuhn\PyProjects\ThammApprove\backend\.env`

```env
# Für Office365:
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=deine-email@firma.de
SMTP_PASS=dein-passwort
EMAIL_FROM=noreply@firma.de

# Für Gmail:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=deine-email@gmail.com
SMTP_PASS=app-password
EMAIL_FROM=deine-email@gmail.com
```

**Nach Änderung:** Backend neu starten (`Strg+C` dann `npm run dev`)

## Dateien und Ordner

- **PDFs werden gespeichert:** `C:\Users\dhuhn\PyProjects\ThammApprove\uploads`
- **Datenbank:** `C:\Users\dhuhn\PyProjects\ThammApprove\backend\database.sqlite`
- **Logs:** `C:\Users\dhuhn\PyProjects\ThammApprove\backend\logs`

## Troubleshooting

### Problem: E-Mails kommen nicht an
- E-Mail Konfiguration in `.env` prüfen
- Backend neu starten nach Änderungen
- Spam-Ordner prüfen

### Problem: PDF wird nicht angezeigt
- Prüfe ob Backend läuft (http://localhost:3101/health)
- Prüfe ob PDF im `uploads` Ordner liegt

### Problem: "Invalid token" Fehler
- Link ist abgelaufen (Standard: 7 Tage)
- Neue Freigabe anfordern

## System stoppen

1. Backend Terminal: `Strg + C`
2. Frontend Terminal: `Strg + C`

## System starten

1. Doppelklick auf: `start-thamm-approve.bat`
2. Oder manuell wie in der Anleitung

---

**Das System ist jetzt einsatzbereit für Tests und Integration mit Switch!** 🚀