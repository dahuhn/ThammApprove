/**
 * ThammApprove Webhook JSON Processor
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
 * Switch Version: ES5 kompatibel
 */

/**
 * Entry Point: JSON-Datei vom Webhook Element
 */
function jobArrived(s, job) {
    var scriptName = "Webhook JSON Processor";

    try {
        s.log(1, scriptName + ": Processing webhook JSON");  // 1 = Info

        // JSON-Inhalt lesen
        var jsonContent = job.readEntireFile();
        s.log(1, scriptName + ": Raw JSON: " + jsonContent);  // 1 = Info (Debug->Info)

        // JSON parsen
        var webhookData = JSON.parse(jsonContent);

        // Validierung
        if (!webhookData.fileName) {
            job.fail(scriptName + ": No fileName in webhook data");
            return;
        }

        if (!webhookData.status) {
            job.fail(scriptName + ": No status in webhook data");
            return;
        }

        s.log(1, scriptName + ": Processing approval for file: " + webhookData.fileName);  // 1 = Info
        s.log(1, scriptName + ": Status: " + webhookData.status);  // 1 = Info
        s.log(1, scriptName + ": JobId: " + webhookData.jobId);  // 1 = Info

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
            s.log(1, scriptName + ": Routing to 'Approved' for Wait for Asset");  // 1 = Info
            routeByName(s, job, "Approved", scriptName);
        } else if (webhookData.status === 'rejected') {
            s.log(1, scriptName + ": Routing to 'Rejected' for Wait for Asset");  // 1 = Info
            routeByName(s, job, "Rejected", scriptName);
        } else {
            s.log(3, scriptName + ": Unknown status: " + webhookData.status);  // 3 = Error
            routeByName(s, job, "Error", scriptName);
        }

    } catch (error) {
        s.log(3, scriptName + ": Error processing webhook JSON - " + error.toString());  // 3 = Error
        job.fail(scriptName + ": " + error.toString());
    }
}

/**
 * Helper function to route by connection name (ES5 compatible)
 */
function routeByName(s, job, targetName, scriptName) {
    // Get number of outgoing connections
    var numConnections = s.getOutgoingConnectionCount ? s.getOutgoingConnectionCount() : 10;

    job.log(1, scriptName + ": Looking for connection named '" + targetName + "'");  // 1 = Info (Debug->Info)

    // Check each connection by number and get its name
    for (var i = 1; i <= numConnections; i++) {
        try {
            var connectionName = s.getOutgoingName ? s.getOutgoingName(i) : null;

            if (connectionName) {
                job.log(1, scriptName + ": Connection " + i + " is named '" + connectionName + "'");  // 1 = Info (Debug->Info)

                // Check if this is our target (case-insensitive, trimmed) - ES5 trim
                if (connectionName.replace(/^\s+|\s+$/g, '').toLowerCase() === targetName.replace(/^\s+|\s+$/g, '').toLowerCase()) {
                    job.log(1, scriptName + ": Routing to '" + targetName + "' via Connection " + i);  // 1 = Info
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
        job.log(1, scriptName + ": Routing to Connection 1 (Approved)");  // 1 = Info
        job.sendToData(1);
    } else if (targetName === "Rejected") {
        job.log(1, scriptName + ": Routing to Connection 2 (Rejected)");  // 1 = Info
        job.sendToData(2);
    } else {
        job.log(2, scriptName + ": No matching connection found for '" + targetName + "', using Error");  // 2 = Warning
        job.sendToData(Connection.Level.Error);
    }
}

/**
 * Script-Start
 */
function scriptStarted(s) {
    s.log(1, "Webhook JSON Processor started");  // 1 = Info
}

/**
 * Script-Stop
 */
function scriptStopped(s) {
    s.log(1, "Webhook JSON Processor stopped");  // 1 = Info
}