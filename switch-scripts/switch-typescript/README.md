# Switch TypeScript Scripts - Offiziell kompatibel

Diese TypeScript-Scripts sind vollständig an die offiziellen Switch Type Definitions angepasst.

## 📋 Installation auf Switch-Server

### 1. Scripts mit SwitchScriptTool erstellen

```cmd
cd "C:\Program Files\Enfocus\Enfocus Switch\SwitchScriptTool"

SwitchScriptTool --create ThammApprove-Submit "C:\Switch Scripts"
SwitchScriptTool --create ThammApprove-WebhookProcessor "C:\Switch Scripts"
SwitchScriptTool --create ThammApprove-StatusCheck "C:\Switch Scripts"
```

### 2. TypeScript-Code kopieren

**Kopiere den KOMPLETTEN Inhalt** der folgenden Dateien in die generierten `main.ts` Dateien:

- `submit-approval-switch.ts` → `C:\Switch Scripts\ThammApprove-Submit\main.ts`
- `webhook-json-processor-switch.ts` → `C:\Switch Scripts\ThammApprove-WebhookProcessor\main.ts`
- `check-approval-status-switch.ts` → `C:\Switch Scripts\ThammApprove-StatusCheck\main.ts`

### 3. In Switch Designer verwenden

Die Scripts werden automatisch kompiliert, wenn sie in Switch importiert werden!

## 🔧 Connection-Konfiguration

### ThammApprove-Submit
- **Connection 1**: Success → Pending Folder
- **Connection 2**: Error → Error Folder

### ThammApprove-WebhookProcessor
- **Connection 1**: Approved → Wait for Asset
- **Connection 2**: Rejected → Wait for Asset
- **Error**: Error handling

### ThammApprove-StatusCheck
- **Connection 1**: Approved
- **Connection 2**: Rejected
- **Connection 3**: Pending (für erneute Prüfung)
- **Connection 4**: Timeout
- **Error**: Error handling

## ✅ Wichtige Anpassungen für offizielle Switch Types

1. **Async/Await überall**
   ```typescript
   // Alt (unser Code)
   const fileName = job.getName();

   // Neu (offizielle Switch Types)
   const fileName = await job.getName();
   ```

2. **HTTP-Verbindungen**
   ```typescript
   // Alt
   const http = new HTTP();

   // Neu
   const http = s.createHttpConnection();
   ```

3. **Numbered Connections mit Type Assertion**
   ```typescript
   // Numbered connection (1, 2, 3...)
   await job.sendToData(1 as any);

   // Named connection (Success, Error)
   await job.sendToData(Connection.Level.Success);
   ```

4. **File Reading**
   ```typescript
   // Text file
   const content = await s.readFile(path);

   // Binary file
   const binary = await s.readBinaryFile(path);
   ```

## 🚀 Properties in Switch Designer

### Submit Script Properties
- `apiUrl`: URL des ThammApprove Servers (default: http://172.16.0.66:3101)
- `customerEmail`: E-Mail des Kunden (oder aus Private Data)
- `customerName`: Name des Kunden (optional)
- `successName`: Name der Success-Connection (default: "Success")
- `errorName`: Name der Error-Connection (default: "Error")

### Webhook Processor Properties
Keine speziellen Properties nötig - verarbeitet JSON vom Webhook Element

### Status Check Properties
- `apiUrl`: URL des ThammApprove Servers
- `checkInterval`: Prüfintervall in Sekunden (default: 60)
- `maxWaitTime`: Maximale Wartezeit in Sekunden (default: 7200)
- `approvedName`: Name der Approved-Connection (default: "Approved")
- `rejectedName`: Name der Rejected-Connection (default: "Rejected")
- `timeoutName`: Name der Timeout-Connection (default: "Timeout")
- `pendingName`: Name der Pending-Connection (default: "Pending")

## 🔍 Debugging

Switch kompiliert TypeScript automatisch und zeigt Fehler im Log:
- Switch Designer → Messages → Script compilation errors
- VS Code kann für Remote-Debugging verwendet werden

## ✅ Vorteile dieser Version

- **100% kompatibel** mit offiziellen Switch Type Definitions
- **Async/Await** für bessere Performance
- **Type Safety** mit TypeScript
- **Automatische Kompilierung** durch Switch
- **IntelliSense** in VS Code
- **Debugging-Support**