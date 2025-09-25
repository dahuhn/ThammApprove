# TypeScript Kompilierung für Switch 2022 Fall+

## 🎯 Übersicht

Enfocus Switch 2022 Fall+ unterstützt TypeScript für moderne Script-Entwicklung. TypeScript-Code muss zu JavaScript kompiliert werden, bevor er in Switch verwendet werden kann.

## 📦 Installation

### 1. Node.js und npm installieren
```bash
# Node.js von https://nodejs.org/ herunterladen und installieren
node --version
npm --version
```

### 2. TypeScript und Abhängigkeiten installieren
```bash
# Im switch-scripts Verzeichnis
npm install

# Global TypeScript Compiler (optional)
npm install -g typescript
```

## 🔧 Konfiguration

### tsconfig.json
Die bereitgestellte `tsconfig.json` ist für Switch optimiert:

```json
{
  "compilerOptions": {
    "target": "ES2020",           // Moderne JS-Features
    "module": "commonjs",         // Switch erwartet CommonJS
    "outDir": "./dist",          // Kompilierte JS-Dateien
    "strict": true,              // Strenge Typisierung
    "removeComments": true       // Kommentare entfernen
  }
}
```

### package.json
Enthält Abhängigkeiten und Build-Scripts:

- `@enfocus-switch/types-switch-scripting`: Offizielle Switch Type Definitions
- `typescript`: TypeScript Compiler
- `rimraf`: Cross-platform Dateien löschen

## 🚀 Kompilierung

### Einmalige Kompilierung
```bash
npm run build
```

### Watch-Modus (automatische Kompilierung)
```bash
npm run build:watch
```

### Clean Build
```bash
npm run clean
npm run build
```

## 📁 Dateistruktur

```
switch-scripts/
├── tsconfig.json                    # TypeScript Konfiguration
├── package.json                     # npm Abhängigkeiten
├── compile-guide.md                 # Diese Anleitung
│
├── TypeScript Source:
├── submit-approval.ts               # TypeScript Quellcode
├── webhook-json-processor.ts
├── check-approval-status.ts
│
├── dist/                           # Kompilierte JavaScript-Dateien
├── submit-approval.js              # → In Switch verwenden
├── webhook-json-processor.js
├── check-approval-status.js
│
└── Fallback (ES5):
├── submit-approval-compatible.js   # Für alte Switch-Versionen
├── webhook-json-processor.js       # (ohne TypeScript)
└── check-approval-status-compatible.js
```

## ✅ Verwendung in Switch

### 1. TypeScript kompilieren
```bash
npm run build
```

### 2. Kompilierte .js Dateien in Switch kopieren
```bash
# Aus dist/ Verzeichnis nach Switch kopieren:
dist/submit-approval.js              → Switch Scripts Verzeichnis
dist/webhook-json-processor.js
dist/check-approval-status.js
```

### 3. In Switch Designer verwenden
- **Script Element** erstellen
- **Kompilierte .js Datei** auswählen (nicht .ts!)
- Properties konfigurieren
- Connections benennen

## 🔍 Type Definitions

### Verfügbare Switch Types:
```typescript
// Hauptklassen
Switch, Job, FlowElement, Connection

// Enums
LogLevel: Info, Warning, Error, Debug
PropertyType: literal, number, date
AccessLevel: ReadOnly, ReadWrite

// Dokument-Typen
PdfDocument, ImageDocument, XmlDocument
```

### Custom Interfaces:
```typescript
interface WebhookPayload {
    jobId: string;
    fileName: string;
    status: 'approved' | 'rejected';
}

interface ApprovalMetadata {
    submitTime: string;
    switchServer: string;
    // ...
}
```

## 🆘 Troubleshooting

### Kompilierungsfehler
```bash
# Typ-Fehler prüfen
npm run build

# Watch-Modus für Live-Feedback
npm run build:watch
```

### Switch Integration
- **Nur .js Dateien** in Switch verwenden (aus dist/)
- **TypeScript .ts Dateien** funktionieren nicht direkt in Switch
- Bei Fehlern: ES5-kompatible .js Versionen als Fallback

### Abhängigkeiten aktualisieren
```bash
npm update
npm audit fix
```

## 📋 Vorteile von TypeScript in Switch

✅ **Type Safety**: Compile-Time Fehlerprüfung
✅ **Moderne Syntax**: Template Strings, const/let, Optional Chaining
✅ **IDE-Support**: IntelliSense, Auto-Complete, Refactoring
✅ **Interfaces**: Strukturierte Datentypen
✅ **Bessere Wartbarkeit**: Selbst-dokumentierender Code

## 🔗 Ressourcen

- [Enfocus Switch Type Definitions](https://github.com/enfocus-switch/types-switch-scripting)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Switch 2022 Fall Release Notes](https://www.enfocus.com/en/news/enfocus-releases-switch-2022-fall)

---

**Fazit:** TypeScript bringt moderne Entwicklung nach Switch! 🚀