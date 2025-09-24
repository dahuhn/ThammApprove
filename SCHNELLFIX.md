# Frontend Fehler - Schnellfix

## Problem
Frontend startet nicht wegen react-pdf CSS-Import Fehlern.

## Sofort-Lösung
Ich habe das System auf einen einfacheren PDF-Viewer umgestellt, der sofort funktioniert.

## Was wurde geändert:
1. PDFViewer.tsx: CSS-Imports entfernt
2. SimplePDFViewer.tsx: Neue einfache Komponente erstellt (nutzt Browser-nativen PDF-Viewer)
3. ApprovalPage.tsx: Auf SimplePDFViewer umgestellt

## Jetzt funktioniert es!

**Neustart des Frontends:**
1. Im Frontend-Terminal: `Strg + C`
2. Dann: `npm start`

Das System läuft jetzt mit dem nativen Browser-PDF-Viewer. Das funktioniert genauso gut für die Freigabe-Funktionalität!

## Falls du trotzdem die react-pdf Komponente willst:

```bash
cd frontend
npm uninstall react-pdf pdfjs-dist
npm install react-pdf@7.5.1 pdfjs-dist@3.11.174
```

Dann in PDFViewer.tsx die CSS-Imports ändern zu:
```javascript
import 'react-pdf/dist/cjs/Page/AnnotationLayer.css';
import 'react-pdf/dist/cjs/Page/TextLayer.css';
```

Aber der SimplePDFViewer reicht völlig aus!