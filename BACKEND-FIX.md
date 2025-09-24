# Backend Probleme behoben

## Problem 1: nodemailer Import
**Fehler:** `createTransporter is not a function`
**Lösung:** `createTransporter` → `createTransport`

## Problem 2: Sequelize Operatoren
**Fehler:** Veraltete `$lt` Syntax
**Lösung:** Moderne `[Op.lt]` Syntax mit Import

## Was wurde geändert:

### email.service.ts
```javascript
// Alt:
const transporter = nodemailer.createTransporter({

// Neu:
const transporter = nodemailer.createTransport({
```

### approval.service.ts & cleanup.service.ts
```javascript
// Import hinzugefügt:
import { Op } from 'sequelize';

// Alt:
expiresAt: { $lt: now }

// Neu:
expiresAt: { [Op.lt]: now }
```

## Jetzt Backend neu starten:

1. Im Backend-Terminal: `Strg + C`
2. Dann: `npm run dev`

Das Backend sollte jetzt ohne Fehler starten!