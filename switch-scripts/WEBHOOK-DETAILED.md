# Webhook-Variante: Sofortige Benachrichtigung statt Polling

## Konzept-Unterschied

### Polling-Variante (aktuell):
```
Switch fragt alle 60s: "Ist die Freigabe fertig?"
→ API antwortet: "Nein, noch pending"
→ Switch wartet 60s und fragt wieder
→ (Wiederholt sich bis approved/rejected/timeout)
```

### Webhook-Variante:
```
Switch reicht PDF ein und wartet passiv
↓
User genehmigt/lehnt PDF ab im Browser
↓
ThammApprove Backend sendet sofort Webhook an Switch
↓
Switch reagiert SOFORT und verschiebt Job
```

## Technischer Ablauf

### 1. Setup Phase

**Switch-Seite:**
```
┌─────────────────┐
│HTTP Server      │
│Element          │  ← Hört auf Port 9090
│                 │  ← URL: http://SWITCH-IP:9090/webhook
│webhook-receiver-│  ← Script: webhook-receiver-compatible.js
│compatible.js    │
└─────────────────┘
```

**ThammApprove Backend:**
- Kennt Switch Webhook-URL: `http://172.16.0.67:9090/webhook`
- Sendet POST-Request bei Approval-Änderung

### 2. Flow-Aufbau mit Webhook

```
[Hot Folder]
     │
     v
[Submit Script] ──Success──► [HTTP Server Element]
     │                           │
     │                           │ (wartet auf Webhook)
     │                           │
     v──Error──► [Error Folder]  │
                                 │
                                 │ Webhook received!
                                 │
                         ┌───────┴────────┐
                         │                │
                         │ "Approved"     │ "Rejected"
                         │                │
                         v                v
                   [Approved Folder] [Rejected Folder]
                         │                │
                         v                v
                   [Final Process]  [Send Notification]
```

### 3. HTTP Server Element Konfiguration

**Element-Typ:** HTTP Server (nicht Script!)
**Properties:**
```
Port: 9090
Endpoint Path: /webhook
Script: webhook-receiver-compatible.js
Allow External Connections: true
```

**Connections:**
- **Ausgang 1:** Name: "Approved" → zu Approved Folder
- **Ausgang 2:** Name: "Rejected" → zu Rejected Folder

## Webhook-Payload Struktur

### Was ThammApprove an Switch sendet:

```json
POST http://172.16.0.67:9090/webhook
Content-Type: application/json

{
  "jobId": "switch-job-12345",
  "status": "approved",
  "approvedBy": "max.mustermann@thamm.de",
  "approvedAt": "2025-01-15T14:30:00Z",
  "comments": "Sieht gut aus, kann gedruckt werden",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Bei Rejection:
```json
{
  "jobId": "switch-job-12345",
  "status": "rejected",
  "rejectedReason": "Farbfehler im Logo",
  "comments": "Logo ist zu dunkel, bitte korrigieren",
  "rejectedBy": "quality@thamm.de",
  "rejectedAt": "2025-01-15T14:35:00Z"
}
```

## Backend-Anpassungen nötig

### 1. Switch Webhook-URL konfigurieren

In `backend/.env`:
```env
SWITCH_WEBHOOK_URL=http://172.16.0.67:9090/webhook
SWITCH_WEBHOOK_ENABLED=true
```

### 2. Webhook-Service implementieren

Neue Datei: `backend/src/services/webhookService.ts`:
```typescript
export class WebhookService {
  private switchWebhookUrl = process.env.SWITCH_WEBHOOK_URL;

  async sendToSwitch(approval: Approval) {
    if (!this.switchWebhookUrl) return;

    const payload = {
      jobId: approval.jobId,
      status: approval.status,
      approvedBy: approval.approvedBy,
      approvedAt: approval.approvedAt,
      rejectedReason: approval.rejectedReason,
      comments: approval.comments
    };

    try {
      await axios.post(this.switchWebhookUrl, payload, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });

      console.log(`Webhook sent to Switch for job ${approval.jobId}`);
    } catch (error) {
      console.error('Failed to send webhook to Switch:', error);
      // Fallback: Switch wird weiter pollen
    }
  }
}
```

### 3. Controller anpassen

In `approvalController.ts`:
```typescript
// Bei approve/reject:
export const approveSubmission = async (req: Request, res: Response) => {
  // ... existing approval logic ...

  // Nach erfolgreichem Update:
  const webhookService = new WebhookService();
  await webhookService.sendToSwitch(approval);

  res.json({ success: true });
};
```

## Workflow-Vergleich

### Polling (aktuell):
```
Time 0s:   Submit PDF
Time 60s:  Check status → pending
Time 120s: Check status → pending
Time 180s: Check status → pending
...
Time 600s: User approves in browser
Time 660s: Check status → approved! ✅
```
**Latenz: Bis zu 60 Sekunden**

### Webhook:
```
Time 0s:   Submit PDF
Time ???:  (Switch wartet passiv)
Time 600s: User approves in browser
Time 600s: Webhook sent → Switch reagiert sofort! ✅
```
**Latenz: < 1 Sekunde**

## Vorteile der Webhook-Variante

### ✅ Performance
- **Keine CPU-Last** durch ständiges Polling
- **Sofortige Reaktion** statt 60s Verzögerung
- **Weniger Netzwerk-Traffic** (nur bei Änderung)

### ✅ Zuverlässigkeit
- **Kein "Lost Update"** Problem
- **Keine verpassten Status-Änderungen**
- **Deterministisches Verhalten**

### ✅ Skalierbarkeit
- **Hunderte PDFs gleichzeitig** ohne Performance-Probleme
- **Hold Job Queue wird nicht verstopft**

## Nachteile/Herausforderungen

### ❌ Netzwerk-Komplexität
- **Firewall:** Port 9090 muss von ThammApprove-Server zu Switch offen sein
- **NAT/Routing:** Switch muss von außen erreichbar sein
- **IP-Adressen:** Feste IPs oder DNS nötig

### ❌ Fehlerbehandlung
- **Webhook fails:** Was passiert wenn Switch offline?
- **Retry-Logic:** Wie oft wiederholen?
- **Fallback:** Polling als Backup?

### ❌ Security
- **Authentication:** Webhook sollte Token/Secret haben
- **HTTPS:** In Produktion zwingend nötig
- **Rate Limiting:** Schutz vor Spam

## Hybrid-Lösung (Empfehlung)

### Best of both worlds:

```
[Submit Script]
     │
     v──Success──► [HTTP Server] ◄──── Webhook (sofort)
                        │
                        v (falls Webhook kommt)
                   [Process immediately]

     │
     v──Success──► [Hold Job 300s] ◄─── Fallback Polling
                        │              (falls Webhook fails)
                        v
                   [Check Status Script]
                        │
                        v (falls noch pending)
                   [Process with delay]
```

**Konfiguration:**
- **Webhook:** Sofortige Reaktion in 99% der Fälle
- **Polling:** 5-Minuten-Intervall als Fallback
- **Timeout:** 2 Stunden Maximum

## Implementation Steps

### 1. Backend erweitern (Webhook senden)
```bash
cd ThammApprove/backend
# WebhookService implementieren
# Controller anpassen
# .env konfigurieren
```

### 2. Switch Flow aufbauen
```
Hot Folder → Submit Script → HTTP Server Element
                ├─ Success → [Webhook Receiver]
                └─ Error → [Error Folder]
```

### 3. Testing
```bash
# Webhook manuell testen:
curl -X POST http://172.16.0.67:9090/webhook \
  -H "Content-Type: application/json" \
  -d '{"jobId":"test-123","status":"approved"}'
```

### 4. Monitoring
- **Switch Log:** Webhook-Empfang protokollieren
- **Backend Log:** Webhook-Versand protokollieren
- **Fallback:** Polling läuft parallel für verpasste Webhooks

## Fazit

**Webhook ist technisch überlegen**, aber **Polling ist robuster** bei Netzwerk-Problemen.

**Empfehlung:** Hybrid-Ansatz mit Webhook als primäre Methode und Polling als Fallback!