# Datenbank-Schema Problem behoben

## Problem
SQLite-Fehler: `no such column: jobId` beim Erstellen der Indizes.

Das passierte weil:
1. Sequelize war auf `underscored: true` gestellt → Spalten wurden zu `job_id` konvertiert
2. Aber die Index-Definition verwendete noch `jobId`
3. Konflikt zwischen erwarteten und tatsächlichen Spaltennamen

## Lösung
1. **Alte Datenbank gelöscht:** `database.sqlite` entfernt
2. **Konfiguration geändert:** `underscored: false` in connection.ts
3. **Feldnamen beibehalten:** Index-Definition passt jetzt zu Spalten

## Was geändert wurde:

### database/connection.ts
```javascript
define: {
  timestamps: true,
  underscored: false  // Geändert von true zu false
}
```

### models/Approval.model.ts
Die Index-Felder blieben bei `jobId` und `expiresAt` (camelCase)

## Backend neu starten:

1. Im Backend-Terminal: `Strg + C`
2. Dann: `npm run dev`

Die Datenbank wird automatisch mit dem korrekten Schema neu erstellt!