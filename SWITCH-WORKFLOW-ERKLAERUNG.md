# Switch Workflow Erklärung: "Hold Job Element"

## Was ist ein "Hold Job" Element?

Ein **Hold Job** ist ein Switch-Element, das Jobs für eine bestimmte Zeit "anhält" bevor sie weitergeschickt werden.

## Warum brauchen wir das?

**Problem:**
- Submit Script sendet PDF an ThammApprove → sofort fertig
- Aber Kunde braucht Zeit zum Anschauen und Freigeben
- Check Status Script würde sofort "pending" finden

**Lösung:**
Das Hold Job Element wartet eine Zeit (z.B. 60 Sekunden) bevor der Job zum Check Status Script geht.

## Aufbau in Switch:

### Variante A: Hold Job Element

```
[Submit Script] → [Hold Job] → [Check Status Script]
                   ↑
                   Hold Time: 60 Sekunden
```

**Hold Job konfigurieren:**
- **Hold Time:** 60 Sekunden (oder länger)
- **Purpose:** Jobs für bestimmte Zeit anhalten

### Variante B: Timer Element

```
[Submit Script] → [Timer] → [Check Status Script]
                   ↑
                   Delay: 60 Sekunden
```

**Timer Element konfigurieren:**
- **Delay:** 60 Sekunden
- **Action:** Send to next element

### Variante C: Hold Job + Polling Loop (Empfohlen)

```
[Submit Script]
    ↓
[Hold Job (60s)] ← ─ ┐
    ↓                │
[Check Status Script]│
    ├─→ Approved     │
    ├─→ Rejected     │
    ├─→ Timeout      │
    └─→ Still Pending┘
```

## Typische Konfiguration:

### 1. Submit Approval Script
- **Verbindung Success** → Hold Job Element

### 2. Hold Job Element
- **Hold Time:** 60-300 Sekunden (1-5 Minuten)
- **Verbindung:** → Check Status Script

### 3. Check Status Script
- **Connection 1 (Approved)** → Approved Folder
- **Connection 2 (Rejected)** → Rejected Folder
- **Connection 3 (Timeout)** → Timeout Folder
- **Connection Success (Pending)** → zurück zum Hold Folder

## Warum verschiedene Zeiten?

**Kurze Hold Time (60s):**
- Schnelle Reaktion auf Freigaben
- Mehr API-Calls zum ThammApprove Server
- Gut für Tests

**Längere Hold Time (300s):**
- Weniger Server-Load auf ThammApprove
- Langsamere Reaktion auf Freigaben
- Gut für Produktion mit vielen Jobs

## Alternative: Webhook (fortgeschritten)

Statt Polling können Sie auch Webhooks verwenden:

```
[Submit Script] → [Webhook Receiver] → [Approved/Rejected]
```

**Vorteil:** Sofortige Benachrichtigung
**Nachteil:** Komplexere Setup

## Praktisches Beispiel:

**Szenario:** Kunde braucht 10 Minuten zum Prüfen

```
[Hot Folder]
    ↓
[Submit Script] (sendet PDF, dauert 2 Sekunden)
    ↓
[Hold Job: 60s] (wartet 1 Minute)
    ↓
[Check Status: "pending"] (Kunde prüft noch)
    ↓ (Success Connection - zurück zur Schleife)
[Hold Job: 60s] (wartet noch 1 Minute)
    ↓
[Check Status: "pending"] (Kunde prüft immer noch)
    ↓ (Success Connection - zurück zur Schleife)
[Hold Job: 60s] (wartet noch 1 Minute)
    ↓
[Check Status: "approved"] (Kunde hat freigegeben!)
    ↓ (Connection 1 - Approved)
[Approved Folder] → Produktion
```

## Wichtig für ThammApprove:

- **Hold Time nicht zu kurz** (mindestens 30-60 Sekunden)
- **Max Wait Time** im Script setzen (z.B. 2 Stunden)
- **Timeout Connection** für abgelaufene Jobs

---

**Das Hold Job Element simuliert also eine "Warteschlange" wo Jobs pausieren, bevor sie erneut geprüft werden!**

## Referenz:
- **Switch Dokumentation:** https://www.enfocus.com/Manuals/UserGuide/SW/11U4/Switch/en-us/reference/r_hold_job.html