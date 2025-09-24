/**
 * ThammApprove Custom Hold Script
 *
 * Dieses Script bildet die Funktionalität eines Hold Elements nach,
 * aber mit webhook-gesteuerter Freigabe statt zeitbasierter Freigabe.
 *
 * Funktionsweise:
 * 1. PDFs kommen vom Submit Script mit ApprovalId
 * 2. Script prüft, ob bereits eine Webhook-Entscheidung vorliegt
 * 3. Wenn ja: PDF wird sofort zu Approved/Rejected weitergeleitet
 * 4. Wenn nein: PDF "wartet" im Script (setAutoComplete(false))
 * 5. Webhook schreibt Entscheidung in decisions/ Verzeichnis
 * 6. Script wird erneut getriggert und gibt wartende PDFs frei
 *
 * Switch Version: ES5 kompatibel
 */

// Globale Variablen für Script-Properties
var refreshIntervalSeconds = 30; // Fallback: alle 30s prüfen
var maxWaitTimeMinutes = 120;    // Max 2h warten, dann zu "Timeout"

/**
 * Entry Point: Job ist angekommen
 */
function jobArrived(s, job) {
    try {
        var approvalId = job.getPrivateData("ApprovalId");
        var arrivalTime = job.getPrivateData("ArrivalTime");

        // Ankunftszeit setzen falls noch nicht gesetzt
        if (!arrivalTime) {
            arrivalTime = new Date().getTime().toString();
            job.setPrivateData("ArrivalTime", arrivalTime);
        }

        // Timeout prüfen
        if (isJobTimedOut(arrivalTime)) {
            s.log(LogLevel.Warning, "Job " + approvalId + " timed out after " + maxWaitTimeMinutes + " minutes");
            routeJobToConnection(s, job, "Timeout", "custom-hold-script.js");
            return;
        }

        s.log(LogLevel.Info, "Processing job with ApprovalId: " + approvalId);

        // Prüfen ob Entscheidung vorliegt
        var decision = checkForDecision(s, approvalId);

        if (decision) {
            s.log(LogLevel.Info, "Decision found for " + approvalId + ": " + decision.status);

            // Entscheidung da -> Job weiterleiten
            if (decision.status === 'approved') {
                routeJobToConnection(s, job, "Approved", "custom-hold-script.js");
            } else if (decision.status === 'rejected') {
                routeJobToConnection(s, job, "Rejected", "custom-hold-script.js");
            } else {
                s.log(LogLevel.Error, "Unknown decision status: " + decision.status);
                job.fail("Unknown approval status: " + decision.status);
            }
        } else {
            // Keine Entscheidung -> Job "parken"
            s.log(LogLevel.Info, "No decision yet for " + approvalId + " - holding job");

            // setAutoComplete(false) verhindert automatische Weiterleitung
            job.setAutoComplete(false);

            // Timer setzen für erneute Prüfung (Fallback falls Webhook trigger nicht funktioniert)
            scheduleRefresh(s, refreshIntervalSeconds);
        }

    } catch (error) {
        s.log(LogLevel.Error, "Error in custom-hold-script: " + error.toString());
        job.fail("Custom hold script error: " + error.toString());
    }
}

/**
 * Timer-basierte Prüfung (Fallback)
 */
function timerFired(s) {
    try {
        s.log(LogLevel.Debug, "Timer fired - checking for pending decisions");

        // Alle wartenden Jobs erneut verarbeiten
        // Das triggert jobArrived() für alle Jobs im Input-Folder
        var inputFolder = s.getPropertyValue("inputFolder");
        if (inputFolder) {
            // Refresh des Input-Folders triggert erneute Verarbeitung
            s.refreshFolder(inputFolder);
        }

    } catch (error) {
        s.log(LogLevel.Error, "Error in timer: " + error.toString());
    }
}

/**
 * Prüft, ob eine Entscheidung für die ApprovalId vorliegt
 */
function checkForDecision(s, approvalId) {
    try {
        var decisionsFolder = getDecisionsFolder(s);
        var decisionFile = new File(decisionsFolder + "/" + approvalId + ".json");

        if (decisionFile.exists) {
            var content = decisionFile.read();
            var decision = JSON.parse(content);

            // Entscheidungsdatei löschen nach dem Lesen
            decisionFile.remove();

            s.log(LogLevel.Debug, "Found decision file for " + approvalId);
            return decision;
        }

        return null;

    } catch (error) {
        s.log(LogLevel.Error, "Error checking for decision: " + error.toString());
        return null;
    }
}

/**
 * Prüft, ob Job zu lange wartet (Timeout)
 */
function isJobTimedOut(arrivalTimeStr) {
    try {
        var arrivalTime = parseInt(arrivalTimeStr, 10);
        var currentTime = new Date().getTime();
        var maxWaitTimeMs = maxWaitTimeMinutes * 60 * 1000;

        return (currentTime - arrivalTime) > maxWaitTimeMs;

    } catch (error) {
        return false; // Im Fehlerfall nicht als Timeout behandeln
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
    }

    return decisionsFolder;
}

/**
 * Timer für erneute Prüfung setzen
 */
function scheduleRefresh(s, seconds) {
    try {
        // Timer-basierte Erneuerung als Fallback
        s.setTimerInterval(seconds);

    } catch (error) {
        s.log(LogLevel.Warning, "Could not schedule refresh timer: " + error.toString());
    }
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
 * Aufräumen beim Script-Start (alte Entscheidungsdateien löschen)
 */
function scriptStarted(s) {
    try {
        s.log(LogLevel.Info, "Custom Hold Script started - cleaning up old decisions");

        var decisionsFolder = getDecisionsFolder(s);
        var folder = new File(decisionsFolder);

        if (folder.exists) {
            var files = folder.list();
            var cutoffTime = new Date().getTime() - (24 * 60 * 60 * 1000); // 24h alt

            for (var i = 0; i < files.length; i++) {
                var file = new File(decisionsFolder + "/" + files[i]);
                if (file.lastModified < cutoffTime) {
                    file.remove();
                    s.log(LogLevel.Debug, "Removed old decision file: " + files[i]);
                }
            }
        }

    } catch (error) {
        s.log(LogLevel.Warning, "Error during cleanup: " + error.toString());
    }
}

/**
 * Script gestoppt - Aufräumen
 */
function scriptStopped(s) {
    try {
        s.log(LogLevel.Info, "Custom Hold Script stopped");

    } catch (error) {
        s.log(LogLevel.Warning, "Error during script stop: " + error.toString());
    }
}