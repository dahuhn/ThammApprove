/**
 * ThammApprove Direct Webhook Receiver
 *
 * Dieses Script empfängt Webhooks vom ThammApprove Server und
 * findet direkt den wartenden Job, um ihn sofort freizugeben.
 *
 * Funktionsweise:
 * 1. Webhook-JSON kommt vom ThammApprove Server an
 * 2. Script extrahiert jobId und status (approved/rejected)
 * 3. Findet wartenden Job mit s.findJobByPrivateData()
 * 4. Gibt Job sofort mit sendTo() frei - KEIN File-Umweg!
 * 5. Webhook-Job wird verworfen
 *
 * Switch Version: ES5 kompatibel
 * Webhook URL: http://newswitchserver.thamm.local:51088/scripting/ThammApprove
 */

/**
 * Entry Point: Webhook-Job ist angekommen
 */
function jobArrived(s, job) {
    try {
        s.log(LogLevel.Info, "Webhook received from ThammApprove server");

        // Webhook-Payload lesen und parsen
        var payload = readWebhookPayload(s, job);
        if (!payload) {
            job.fail("Could not read webhook payload");
            return;
        }

        s.log(LogLevel.Info, "Processing webhook for jobId: " + payload.jobId + ", status: " + payload.status);

        // Validierung
        if (!validatePayload(payload)) {
            job.fail("Invalid webhook payload: " + JSON.stringify(payload));
            return;
        }

        // Wartenden Job direkt finden und freigeben
        var success = processWaitingJob(s, payload);

        if (success) {
            s.log(LogLevel.Info, "Successfully processed approval for job " + payload.jobId);
            job.sendToNull(); // Webhook-Job erfolgreich verwerfen
        } else {
            job.fail("Could not find or process waiting job " + payload.jobId);
        }

    } catch (error) {
        s.log(LogLevel.Error, "Error processing webhook: " + error.toString());
        job.fail("Webhook processing error: " + error.toString());
    }
}

/**
 * Wartenden Job finden und direkt freigeben
 */
function processWaitingJob(s, payload) {
    try {
        // Job mit ApprovalId finden
        var waitingJob = s.findJobByPrivateData("ApprovalId", payload.jobId);

        if (!waitingJob) {
            s.log(LogLevel.Warning, "No waiting job found for ApprovalId: " + payload.jobId);
            return false;
        }

        s.log(LogLevel.Info, "Found waiting job: " + waitingJob.getName() + " for ApprovalId: " + payload.jobId);

        // Job-Status in Private Data aktualisieren
        waitingJob.setPrivateData("ApprovalStatus", payload.status);
        waitingJob.setPrivateData("ApprovalProcessedTime", new Date().toISOString());

        if (payload.customerEmail) {
            waitingJob.setPrivateData("ApprovalCustomerEmail", payload.customerEmail);
        }

        // Job zur richtigen Connection weiterleiten
        if (payload.status === 'approved') {
            s.log(LogLevel.Info, "Approving job " + payload.jobId);
            routeJobToConnection(s, waitingJob, "Approved", "webhook-receiver-direct");
        } else if (payload.status === 'rejected') {
            s.log(LogLevel.Info, "Rejecting job " + payload.jobId);
            routeJobToConnection(s, waitingJob, "Rejected", "webhook-receiver-direct");
        } else {
            s.log(LogLevel.Error, "Unknown status: " + payload.status);
            return false;
        }

        return true;

    } catch (error) {
        s.log(LogLevel.Error, "Error processing waiting job: " + error.toString());
        return false;
    }
}

/**
 * Webhook-Payload aus Job lesen und parsen
 */
function readWebhookPayload(s, job) {
    try {
        // Job-Inhalt als JSON lesen
        var jsonContent = job.readEntireFile();
        s.log(LogLevel.Debug, "Raw webhook payload: " + jsonContent);

        // JSON parsen
        var payload = JSON.parse(jsonContent);
        return payload;

    } catch (error) {
        s.log(LogLevel.Error, "Error reading webhook payload: " + error.toString());
        return null;
    }
}

/**
 * Webhook-Payload validieren
 */
function validatePayload(payload) {
    // Erforderliche Felder prüfen
    if (!payload.jobId || typeof payload.jobId !== 'string') {
        return false;
    }

    if (!payload.status || (payload.status !== 'approved' && payload.status !== 'rejected')) {
        return false;
    }

    // Optional: Token validieren (falls implementiert)
    if (payload.token && typeof payload.token !== 'string') {
        return false;
    }

    return true;
}

/**
 * Job zu benannter Connection weiterleiten (mit Fallback auf Nummern)
 */
function routeJobToConnection(s, job, connectionName, scriptName) {
    try {
        var connections = s.getOutConnections();
        var targetConnection = null;

        // 1. Versuch: Nach Name suchen
        for (var i = 0; i < connections.length; i++) {
            var conn = connections[i];
            var name = conn.getName();

            // Leerzeichen entfernen für Vergleich (ES5 trim workaround)
            if (name && name.replace(/^\s+|\s+$/g, '') === connectionName) {
                targetConnection = conn;
                break;
            }
        }

        // 2. Versuch: Fallback auf Index basierend auf Namen
        if (!targetConnection) {
            var connectionIndex = getConnectionIndexByName(connectionName);
            if (connectionIndex >= 0 && connectionIndex < connections.length) {
                targetConnection = connections[connectionIndex];
            }
        }

        // 3. Job senden oder Fehler
        if (targetConnection) {
            s.log(LogLevel.Info, scriptName + ": Sending job to connection '" + connectionName + "'");
            job.sendTo(targetConnection);
        } else {
            var errorMsg = "Connection '" + connectionName + "' not found. Available connections: " + getConnectionNames(connections);
            s.log(LogLevel.Error, errorMsg);
            job.fail(errorMsg);
        }

    } catch (error) {
        s.log(LogLevel.Error, "Error routing job: " + error.toString());
        job.fail("Routing error: " + error.toString());
    }
}

/**
 * Connection-Index basierend auf Namen bestimmen
 */
function getConnectionIndexByName(connectionName) {
    switch (connectionName) {
        case "Approved": return 0;
        case "Rejected": return 1;
        case "Timeout": return 2;
        case "Error": return 3;
        default: return -1;
    }
}

/**
 * Namen aller verfügbaren Connections abrufen (für Debugging)
 */
function getConnectionNames(connections) {
    var names = [];
    for (var i = 0; i < connections.length; i++) {
        var name = connections[i].getName();
        names.push(name || ("Connection_" + i));
    }
    return names.join(", ");
}

/**
 * Script-Start: Initialisierung
 */
function scriptStarted(s) {
    try {
        s.log(LogLevel.Info, "Direct Webhook Receiver started - ready to receive and process approvals immediately");

    } catch (error) {
        s.log(LogLevel.Warning, "Error during webhook receiver startup: " + error.toString());
    }
}

/**
 * Script gestoppt
 */
function scriptStopped(s) {
    try {
        s.log(LogLevel.Info, "Direct Webhook Receiver stopped");

    } catch (error) {
        s.log(LogLevel.Warning, "Error during script stop: " + error.toString());
    }
}

/**
 * Test-Funktion für manuelle Webhook-Simulation
 */
function simulateWebhook(s, jobId, status) {
    try {
        s.log(LogLevel.Info, "Simulating webhook: " + jobId + " -> " + status);

        var payload = {
            jobId: jobId,
            status: status,
            timestamp: new Date().toISOString(),
            source: "simulation"
        };

        var success = processWaitingJob(s, payload);

        if (success) {
            s.log(LogLevel.Info, "Webhook simulation completed successfully");
        } else {
            s.log(LogLevel.Error, "Webhook simulation failed");
        }

        return success;

    } catch (error) {
        s.log(LogLevel.Error, "Error in webhook simulation: " + error.toString());
        return false;
    }
}