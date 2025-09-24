/**
 * ThammApprove Webhook Receiver with File-based Release
 *
 * Dieses Script empfängt Webhooks vom ThammApprove Server und
 * schreibt die Entscheidung in eine Datei, die das custom-hold-script.js
 * liest und dann die wartenden PDFs freigibt.
 *
 * Funktionsweise:
 * 1. Webhook-JSON kommt vom ThammApprove Server an
 * 2. Script extrahiert jobId und status (approved/rejected)
 * 3. Entscheidung wird in decisions/{jobId}.json geschrieben
 * 4. Custom Hold Script wird getriggert um wartende Jobs zu verarbeiten
 * 5. Custom Hold Script findet die Entscheidung und gibt PDF frei
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

        // Webhook-Payload lesen
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

        // Entscheidung in Datei schreiben
        if (writeDecisionFile(s, payload)) {
            s.log(LogLevel.Info, "Decision written for job " + payload.jobId);

            // Custom Hold Script triggern um wartende Jobs zu verarbeiten
            triggerJobProcessing(s);

            // Webhook-Job erfolgreich verwerfen
            job.sendToNull();

            // Optional: Success-Response senden (falls konfiguriert)
            sendWebhookResponse(s, job, true, "Decision processed successfully");

        } else {
            s.log(LogLevel.Error, "Failed to write decision file for job " + payload.jobId);
            job.fail("Could not write decision file");
        }

    } catch (error) {
        s.log(LogLevel.Error, "Error processing webhook: " + error.toString());
        job.fail("Webhook processing error: " + error.toString());
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
 * Entscheidung in Datei schreiben für Custom Hold Script
 */
function writeDecisionFile(s, payload) {
    try {
        var decisionsFolder = getDecisionsFolder(s);
        var filename = payload.jobId + ".json";
        var filepath = decisionsFolder + "/" + filename;

        // Entscheidungsdaten vorbereiten
        var decisionData = {
            jobId: payload.jobId,
            status: payload.status,
            timestamp: new Date().toISOString(),
            source: "webhook"
        };

        // Optional: Zusätzliche Daten aus Webhook
        if (payload.token) {
            decisionData.token = payload.token;
        }
        if (payload.customerEmail) {
            decisionData.customerEmail = payload.customerEmail;
        }

        // Datei schreiben
        var decisionFile = new File(filepath);
        var jsonString = JSON.stringify(decisionData, null, 2);
        decisionFile.write(jsonString);

        s.log(LogLevel.Debug, "Decision file written: " + filepath);
        return true;

    } catch (error) {
        s.log(LogLevel.Error, "Error writing decision file: " + error.toString());
        return false;
    }
}

/**
 * Custom Hold Script triggern um wartende Jobs zu verarbeiten
 */
function triggerJobProcessing(s) {
    try {
        s.log(LogLevel.Debug, "Triggering custom hold script to process waiting jobs");

        // Verschiedene Trigger-Methoden versuchen

        // 1. Flow-Element direkt triggern (wenn verfügbar)
        if (typeof s.getElement === 'function') {
            var holdElement = s.getElement("Custom Hold Script");
            if (holdElement && typeof holdElement.refresh === 'function') {
                holdElement.refresh();
                s.log(LogLevel.Debug, "Triggered hold element refresh");
                return;
            }
        }

        // 2. Input-Folder refresh (Fallback)
        if (typeof s.refreshFolder === 'function') {
            // Annahme: Custom Hold Script überwacht einen bestimmten Ordner
            var holdInputFolder = s.getPropertyValue("holdInputFolder");
            if (holdInputFolder) {
                s.refreshFolder(holdInputFolder);
                s.log(LogLevel.Debug, "Refreshed hold input folder");
                return;
            }
        }

        // 3. Signal-Datei schreiben (Fallback)
        writeSignalFile(s);

    } catch (error) {
        s.log(LogLevel.Warning, "Could not trigger job processing: " + error.toString());
        // Nicht als Fehler behandeln, da Custom Hold Script periodisch prüft
    }
}

/**
 * Signal-Datei schreiben um Custom Hold Script zu benachrichtigen
 */
function writeSignalFile(s) {
    try {
        var decisionsFolder = getDecisionsFolder(s);
        var signalFile = new File(decisionsFolder + "/trigger.signal");

        var signalData = {
            timestamp: new Date().toISOString(),
            action: "process_waiting_jobs"
        };

        signalFile.write(JSON.stringify(signalData));
        s.log(LogLevel.Debug, "Signal file written to trigger job processing");

    } catch (error) {
        s.log(LogLevel.Warning, "Could not write signal file: " + error.toString());
    }
}

/**
 * Decisions-Verzeichnis erstellen/abrufen
 */
function getDecisionsFolder(s) {
    var tempPath = s.getTemplatePath();
    var decisionsFolder = tempPath + "/decisions";

    // Verzeichnis erstellen falls nicht vorhanden
    var folder = new File(decisionsFolder);
    if (!folder.exists) {
        folder.makeFolder();
        s.log(LogLevel.Debug, "Created decisions folder: " + decisionsFolder);
    }

    return decisionsFolder;
}

/**
 * Optional: Webhook-Response senden (falls konfiguriert)
 */
function sendWebhookResponse(s, job, success, message) {
    try {
        // Prüfen ob Response gewünscht ist
        var sendResponse = s.getPropertyValue("sendWebhookResponse");
        if (sendResponse !== "true") {
            return;
        }

        var response = {
            success: success,
            message: message,
            timestamp: new Date().toISOString()
        };

        // Response als Job-Output (falls konfiguriert)
        var responseConnection = findConnectionByName(s, "Response");
        if (responseConnection) {
            var tempFile = job.createPathWithName("webhook_response.json");
            var responseFile = new File(tempFile);
            responseFile.write(JSON.stringify(response, null, 2));

            job.sendTo(responseConnection, tempFile);
            s.log(LogLevel.Debug, "Webhook response sent");
        }

    } catch (error) {
        s.log(LogLevel.Warning, "Could not send webhook response: " + error.toString());
    }
}

/**
 * Connection nach Name suchen
 */
function findConnectionByName(s, connectionName) {
    try {
        var connections = s.getOutConnections();

        for (var i = 0; i < connections.length; i++) {
            var conn = connections[i];
            var name = conn.getName();

            // Leerzeichen entfernen für Vergleich (ES5 trim workaround)
            if (name && name.replace(/^\s+|\s+$/g, '') === connectionName) {
                return conn;
            }
        }

        return null;

    } catch (error) {
        s.log(LogLevel.Warning, "Error finding connection: " + error.toString());
        return null;
    }
}

/**
 * Script-Start: Aufräumen
 */
function scriptStarted(s) {
    try {
        s.log(LogLevel.Info, "Webhook Receiver started - ready to receive approval decisions");

        // Alte Signal-Dateien aufräumen
        cleanupSignalFiles(s);

    } catch (error) {
        s.log(LogLevel.Warning, "Error during webhook receiver startup: " + error.toString());
    }
}

/**
 * Alte Signal-Dateien aufräumen
 */
function cleanupSignalFiles(s) {
    try {
        var decisionsFolder = getDecisionsFolder(s);
        var signalFile = new File(decisionsFolder + "/trigger.signal");

        if (signalFile.exists) {
            signalFile.remove();
            s.log(LogLevel.Debug, "Cleaned up old signal file");
        }

    } catch (error) {
        s.log(LogLevel.Debug, "No signal file cleanup needed: " + error.toString());
    }
}

/**
 * Script gestoppt
 */
function scriptStopped(s) {
    try {
        s.log(LogLevel.Info, "Webhook Receiver stopped");

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

        if (writeDecisionFile(s, payload)) {
            triggerJobProcessing(s);
            s.log(LogLevel.Info, "Webhook simulation completed");
            return true;
        }

        return false;

    } catch (error) {
        s.log(LogLevel.Error, "Error in webhook simulation: " + error.toString());
        return false;
    }
}