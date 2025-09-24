# Switch Flow Schema für ThammApprove

## Kompletter Workflow mit Named Connections

```
[Hot Folder Input]
        |
        v
[Script: submit-approval-compatible.js]
    |                    |
    v--"Success"---->    v--"Error"---->[Error Folder/Log]
    |
    v
[Hold Job Element]
    - Interval: 60 Sekunden
    - Timeout: Optional (z.B. 2h)
        |
        v
[Script: check-approval-status-compatible.js]
    |              |              |              |
    v--"Approved"  v--"Rejected"  v--"Timeout"   v--"Pending"
    |              |              |              |
    v              v              v              |
[Approved      [Rejected       [Timeout         |
 Folder]        Folder]         Folder]         |
    |              |              |             |
    v              v              v             |
[Weitere       [Notify         [Manual         |
 Processing]    Reject]         Review]         |
                                                |
                                                |
    <-------------------------------------------+
    (Loop zurück zu Hold Job)
```

## Element-Details

### 1. Hot Folder Input
- **Typ:** Hot Folder
- **Pfad:** Z.B. `/input/pdfs/`
- **Filter:** `*.pdf`

### 2. Submit Script Element
- **Typ:** Script Element
- **Script:** `submit-approval-compatible.js`
- **Connections:**
  - **Ausgang 1:** Name: "Success" → zu Hold Job
  - **Ausgang 2:** Name: "Error" → zu Error Folder

**Properties:**
```
apiUrl = http://172.16.0.66:3101
customerEmail = kunde@beispiel.de
successName = Success    (optional)
errorName = Error        (optional)
```

### 3. Hold Job Element
- **Typ:** Hold Job
- **Hold Time:** 60 Sekunden
- **Connection:** zu Check Status Script

### 4. Check Status Script Element
- **Typ:** Script Element
- **Script:** `check-approval-status-compatible.js`
- **Connections:**
  - **Ausgang 1:** Name: "Approved" → zu Approved Folder
  - **Ausgang 2:** Name: "Rejected" → zu Rejected Folder
  - **Ausgang 3:** Name: "Timeout" → zu Timeout Folder
  - **Success-Ausgang:** Name: "Pending" → zurück zu Hold Job (Loop!)

**Properties:**
```
apiUrl = http://172.16.0.66:3101
checkInterval = 60       (Sekunden)
maxWaitTime = 7200       (Sekunden = 2 Stunden)
approvedName = Approved  (optional)
rejectedName = Rejected  (optional)
timeoutName = Timeout    (optional)
pendingName = Pending    (optional)
```

### 5. Ziel-Ordner
- **Approved Folder:** Z.B. `/output/approved/`
- **Rejected Folder:** Z.B. `/output/rejected/`
- **Timeout Folder:** Z.B. `/output/timeout/`
- **Error Folder:** Z.B. `/output/error/`

## Wichtige Connection-Einstellungen

### Connection-Namen vergeben:
1. **Im Switch Designer:** Element auswählen
2. **Rechtsklick auf Connection-Linie**
3. **Properties öffnen**
4. **Name-Feld ausfüllen:** z.B. "Approved"

### Kritischer Punkt - Pending Loop:
```
[Check Status Script] --Success--> [Hold Job] ---> [Check Status Script]
        ^                                               |
        |                                               |
        +-- "Pending" Connection (muss zurück führen!) -+
```

**WICHTIG:** Der "Pending"-Ausgang vom Check Status Script MUSS zurück zum Hold Job Element führen!

## Alternative: Mit Webhooks (Optional)

```
[Hot Folder] → [Submit Script] --Success--> [Webhook Receiver]
                     |                            |        |
                     v--Error--> [Error]         |        |
                                                  v        v
                                           [Approved]  [Rejected]
```

### Webhook Receiver Element:
- **Typ:** HTTP Server
- **Script:** `webhook-receiver-compatible.js`
- **Port:** 9090
- **Endpoint:** `/webhook`

## Fallback ohne Named Connections

Falls Named Connections nicht funktionieren, nutzen die Scripts automatisch diese Nummern:

**Submit Script:**
- Connection.Level.Success = Standard Success
- Connection.Level.Error = Standard Error

**Check Status Script:**
- Connection 1 = Approved
- Connection 2 = Rejected
- Connection 3 = Timeout
- Connection.Level.Success = Pending (Loop)

## Testing des Flows

1. **PDF in Hot Folder legen**
2. **Switch Log prüfen:**
   ```
   ThammApprove Submit: Submitting test.pdf for approval
   ThammApprove Submit: Routing to 'Success' via Connection 1
   ThammApprove Status Check: Looking for connection named 'Pending'
   ThammApprove Status Check: Connection 4 is named 'Pending'
   ThammApprove Status Check: Still pending, will check again in 60 seconds
   ```
3. **Im ThammApprove Interface PDF genehmigen/ablehnen**
4. **Job sollte in entsprechenden Ordner landen**

## Häufige Probleme

### "Connection not found" Fehler:
- **Lösung:** Connection-Namen prüfen, Groß-/Kleinschreibung beachten
- **Debug:** LogLevel auf Debug setzen, Scripts zeigen alle gefundenen Connection-Namen

### Jobs hängen in Pending:
- **Lösung:** API-URL erreichbar? Check Interval zu hoch?
- **Check:** `http://172.16.0.66:3101/api/approvals/status/JOB-ID` manuell testen

### Loop funktioniert nicht:
- **Lösung:** "Pending"-Connection muss wirklich zurück zum Hold Job führen!
- **Nicht:** Pending → Success Connection verwenden