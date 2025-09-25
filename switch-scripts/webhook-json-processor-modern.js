/**
 * ThammApprove Webhook JSON Processor (TypeScript)
 *
 * Dieses Script verarbeitet die JSON-Datei, die vom Webhook Element erstellt wird.
 * Es liest den Dateinamen aus der JSON und bereitet die Information für
 * das Wait for Asset Tool vor.
 *
 * Funktionsweise:
 * 1. Webhook Element empfängt HTTP POST und erstellt kleine JSON-Datei
 * 2. Dieses Script liest die JSON-Datei
 * 3. Extrahiert fileName und status
 * 4. Setzt Private Data für nachfolgende Flow-Elemente
 * 5. Wait for Asset Tool kann dann nach der Datei suchen
 *
 * Switch Version: TypeScript (2022 Fall+)
 */

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

/**
 * Entry Point: JSON-Datei vom Webhook Element
 */
function jobArrived(s: Switch, job: Job): void {
    const scriptName = "Webhook JSON Processor";

    try {
        s.log(LogLevel.Info, `${scriptName}: Processing webhook JSON`);

        // JSON-Inhalt lesen
        const jsonContent = job.readEntireFile();
        s.log(LogLevel.Debug, `${scriptName}: Raw JSON: ${jsonContent}`);

        // JSON parsen
        const webhookData: WebhookPayload = JSON.parse(jsonContent);

        // Validierung
        if (!webhookData.fileName) {
            job.fail(`${scriptName}: No fileName in webhook data`);
            return;
        }

        if (!webhookData.status) {
            job.fail(`${scriptName}: No status in webhook data`);
            return;
        }

        s.log(LogLevel.Info, `${scriptName}: Processing approval for file: ${webhookData.fileName}`);
        s.log(LogLevel.Info, `${scriptName}: Status: ${webhookData.status}`);
        s.log(LogLevel.Info, `${scriptName}: JobId: ${webhookData.jobId}`);

        // Private Data setzen für nachfolgende Elemente
        job.setPrivateData("WebhookFileName", webhookData.fileName);
        job.setPrivateData("WebhookStatus", webhookData.status);
        job.setPrivateData("WebhookJobId", webhookData.jobId);

        // Optional: Weitere Daten aus Webhook
        if (webhookData.approvedBy) {
            job.setPrivateData("ApprovedBy", webhookData.approvedBy);
        }
        if (webhookData.rejectedReason) {
            job.setPrivateData("RejectedReason", webhookData.rejectedReason);
        }
        if (webhookData.comments) {
            job.setPrivateData("Comments", webhookData.comments);
        }

        // Status-basiertes Routing zu Named Connections
        if (webhookData.status === 'approved') {
            s.log(LogLevel.Info, `${scriptName}: Routing to 'Approved' for Wait for Asset`);
            routeByName(s, job, "Approved", scriptName);
        } else if (webhookData.status === 'rejected') {
            s.log(LogLevel.Info, `${scriptName}: Routing to 'Rejected' for Wait for Asset`);
            routeByName(s, job, "Rejected", scriptName);
        } else {
            s.log(LogLevel.Error, `${scriptName}: Unknown status: ${webhookData.status}`);
            routeByName(s, job, "Error", scriptName);
        }

    } catch (error: any) {
        s.log(LogLevel.Error, `${scriptName}: Error processing webhook JSON - ${error.toString()}`);
        job.fail(`${scriptName}: ${error.toString()}`);
    }
}

/**
 * Helper function to route by connection name (TypeScript)
 */
function routeByName(s: Switch, job: Job, targetName: string, scriptName: string): void {
    // Get number of outgoing connections
    const numConnections = s.getOutgoingConnectionCount?.() || 10;

    job.log(LogLevel.Debug, `${scriptName}: Looking for connection named '${targetName}'`);

    // Check each connection by number and get its name
    for (let i = 1; i <= numConnections; i++) {
        try {
            const connectionName = s.getOutgoingName?.(i);

            if (connectionName) {
                job.log(LogLevel.Debug, `${scriptName}: Connection ${i} is named '${connectionName}'`);

                // Check if this is our target (case-insensitive, trimmed)
                if (connectionName.trim().toLowerCase() === targetName.trim().toLowerCase()) {
                    job.log(LogLevel.Info, `${scriptName}: Routing to '${targetName}' via Connection ${i}`);
                    job.sendToData(i);
                    return;
                }
            }
        } catch (e) {
            // Connection doesn't exist, continue
        }
    }

    // Fallback routing based on status
    if (targetName === "Approved") {
        job.log(LogLevel.Info, `${scriptName}: Routing to Connection 1 (Approved)`);
        job.sendToData(1);
    } else if (targetName === "Rejected") {
        job.log(LogLevel.Info, `${scriptName}: Routing to Connection 2 (Rejected)`);
        job.sendToData(2);
    } else {
        job.log(LogLevel.Warning, `${scriptName}: No matching connection found for '${targetName}', using Error`);
        job.sendToData(Connection.Level.Error);
    }
}

/**
 * Script-Start
 */
function scriptStarted(s: Switch): void {
    s.log(LogLevel.Info, "Webhook JSON Processor started");
}

/**
 * Script-Stop
 */
function scriptStopped(s: Switch): void {
    s.log(LogLevel.Info, "Webhook JSON Processor stopped");
}