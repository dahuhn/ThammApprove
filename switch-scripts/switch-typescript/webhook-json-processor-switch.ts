// ThammApprove Webhook JSON Processor
// Vollständig angepasst für offizielle Switch TypeScript Definitionen

interface WebhookPayload {
    jobId: string;
    fileName: string;
    status: 'approved' | 'rejected';
    approvedBy?: string;
    rejectedBy?: string;
    rejectedReason?: string;
    comments?: string;
    token?: string;
}

async function jobArrived(s: Switch, job: Job): Promise<void> {
    const scriptName = "Webhook JSON Processor";

    try {
        await s.log(LogLevel.Info, `${scriptName}: Processing webhook JSON`);

        // JSON-Inhalt lesen
        const jsonPath = await job.getPath();
        const jsonContent = await s.readFile(jsonPath);
        await s.log(LogLevel.Debug, `${scriptName}: Raw JSON: ${jsonContent}`);

        // JSON parsen
        const webhookData: WebhookPayload = JSON.parse(jsonContent);

        // Validierung
        if (!webhookData.fileName) {
            await job.fail(`${scriptName}: No fileName in webhook data`);
            return;
        }

        if (!webhookData.status) {
            await job.fail(`${scriptName}: No status in webhook data`);
            return;
        }

        await s.log(LogLevel.Info, `${scriptName}: Processing approval for file: ${webhookData.fileName}`);
        await s.log(LogLevel.Info, `${scriptName}: Status: ${webhookData.status}`);
        await s.log(LogLevel.Info, `${scriptName}: JobId: ${webhookData.jobId}`);

        // Private Data setzen für nachfolgende Elemente
        await job.setPrivateData("WebhookFileName", webhookData.fileName);
        await job.setPrivateData("WebhookStatus", webhookData.status);
        await job.setPrivateData("WebhookJobId", webhookData.jobId);

        // Optional: Weitere Daten aus Webhook
        if (webhookData.approvedBy) {
            await job.setPrivateData("ApprovedBy", webhookData.approvedBy);
        }
        if (webhookData.rejectedReason) {
            await job.setPrivateData("RejectedReason", webhookData.rejectedReason);
        }
        if (webhookData.comments) {
            await job.setPrivateData("Comments", webhookData.comments);
        }

        // Status-basiertes Routing
        // Connection 1: Approved
        // Connection 2: Rejected
        // Connection.Level.Error: Fehler

        if (webhookData.status === 'approved') {
            await s.log(LogLevel.Info, `${scriptName}: Routing to 'Approved' (Connection 1) for Wait for Asset`);
            await job.sendToData(1 as any); // Connection 1 für Approved
        } else if (webhookData.status === 'rejected') {
            await s.log(LogLevel.Info, `${scriptName}: Routing to 'Rejected' (Connection 2) for Wait for Asset`);
            await job.sendToData(2 as any); // Connection 2 für Rejected
        } else {
            await s.log(LogLevel.Error, `${scriptName}: Unknown status: ${webhookData.status}`);
            await job.sendToData(Connection.Level.Error);
        }

    } catch (error: any) {
        await s.log(LogLevel.Error, `${scriptName}: Error processing webhook JSON - ${error.toString()}`);
        await job.fail(`${scriptName}: ${error.toString()}`);
    }
}

// Entry point for script start
async function scriptStarted(s: Switch): Promise<void> {
    await s.log(LogLevel.Info, "Webhook JSON Processor started");
}

// Entry point for script stop
async function scriptStopped(s: Switch): Promise<void> {
    await s.log(LogLevel.Info, "Webhook JSON Processor stopped");
}