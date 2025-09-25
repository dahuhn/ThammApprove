// ThammApprove Webhook JSON Processor
// Modern JavaScript (no TypeScript) for Switch 2022+

async function jobArrived(s, job) {
    const scriptName = "Webhook JSON Processor";

    try {
        await s.log(LogLevel.Info, `${scriptName}: Processing webhook JSON`);

        // JSON-Inhalt lesen
        const jsonPath = await job.get(AccessLevel.ReadOnly);
        const fs = require('fs');
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');

        await s.log(LogLevel.Debug, `${scriptName}: Raw JSON: ${jsonContent}`);

        // JSON parsen
        const webhookData = JSON.parse(jsonContent);

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

        // Private Data setzen für nachfolgende Elemente (Wait for Asset)
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

        // Status-basiertes Routing zu Named Connections
        // Connection 1: Approved (für Wait for Asset)
        // Connection 2: Rejected (für Wait for Asset)
        // Connection 3: Error

        if (webhookData.status === 'approved') {
            await s.log(LogLevel.Info, `${scriptName}: Routing to 'Approved' (Connection 1) for Wait for Asset`);
            await job.sendToData(1);
        } else if (webhookData.status === 'rejected') {
            await s.log(LogLevel.Info, `${scriptName}: Routing to 'Rejected' (Connection 2) for Wait for Asset`);
            await job.sendToData(2);
        } else {
            await s.log(LogLevel.Error, `${scriptName}: Unknown status: ${webhookData.status}`);
            await job.sendToData(3); // Error connection
        }

    } catch (error) {
        await s.log(LogLevel.Error, `${scriptName}: Error processing webhook JSON - ${error.toString()}`);
        await job.fail(`${scriptName}: ${error.toString()}`);
    }
}

// Entry point for script start
async function scriptStarted(s) {
    await s.log(LogLevel.Info, "Webhook JSON Processor started");
}

// Entry point for script stop
async function scriptStopped(s) {
    await s.log(LogLevel.Info, "Webhook JSON Processor stopped");
}