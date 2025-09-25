// Enfocus Switch Script: Submit PDF for Approval (ES5 Safe)
// Based on working compatible version with only error handlers fixed
// WICHTIG: Nutzt Named Connections mit bewährter ES5 API!

function jobArrived(s, job) {
    var scriptName = "ThammApprove Submit";

    try {
        // Get configuration from Switch flow element properties (BEWÄHRTE API)
        var apiUrl = s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        job.log(1, scriptName + ": Using API URL: " + apiUrl);  // 1 = Info
        var customerEmail = s.getPropertyValue("customerEmail") || job.getPrivateData("CustomerEmail");
        var customerName = s.getPropertyValue("customerName") || job.getPrivateData("CustomerName");
        var notificationEmail = s.getPropertyValue("notificationEmail");

        job.log(1, scriptName + ": Customer Email: " + (customerEmail || "NOT SET"));
        job.log(1, scriptName + ": Customer Name: " + (customerName || "NOT SET"));

        // CONNECTION NAMES - können in Properties definiert werden
        var successName = s.getPropertyValue("successName") || "Success";
        var errorName = s.getPropertyValue("errorName") || "Error";

        // Validate required fields
        if (!customerEmail) {
            job.log(3, scriptName + ": Customer email is required - set customerEmail property or CustomerEmail private data");
            routeByName(s, job, errorName, scriptName);
            return;
        }

        // Get job information (BEWÄHRTE API)
        var jobPath = job.getPath();
        var fileName = job.getName();
        var jobId = job.getName() + "_" + new Date().getTime();

        // Store original filename for later webhook processing
        job.setPrivateData("OriginalFileName", fileName);

        // Prepare metadata (minimal für Switch ES5)
        var metadata = {
            submitTime: toISOString(new Date()),
            originalPath: jobPath,
            fileName: fileName
        };

        // Switch HTTP API: Korrekte Implementierung basierend auf Dokumentation
        job.log(1, scriptName + ": Submitting " + fileName + " for approval via HTTP API");

        var http = new HTTP();

        // HTTP Setup laut Switch Dokumentation
        http.url = apiUrl + "/api/approvals/create";  // Zurück zur Original Multipart Route

        // Datei anhängen mit setAttachedFile()
        http.setAttachedFile(jobPath);

        // Parameter hinzufügen mit addParameter()
        http.addParameter("jobId", jobId);
        http.addParameter("fileName", fileName);
        http.addParameter("customerEmail", customerEmail);
        http.addParameter("customerName", customerName || "");
        http.addParameter("metadata", JSON.stringify(metadata));

        // enableMime = true für multipart/form-data (wie FormData)
        http.enableMime = true;

        job.log(1, scriptName + ": Starting HTTP POST with attached file");

        // POST Request starten (asynchron)
        http.post();

        // Auf Completion warten (30 Sekunden Timeout)
        var success = http.waitForFinished(30000);

        if (!success) {
            job.log(3, scriptName + ": HTTP request timeout after 30 seconds");
            routeByName(s, job, errorName, scriptName);
            return;
        }

        // Response holen
        var responseData = http.getServerResponse();
        var statusCode = http.finishedStatus;

        job.log(1, scriptName + ": HTTP finished with status " + statusCode);

        // SByteArray zu String konvertieren (Switch ES5 spezifisch)
        var responseString = "";
        try {
            if (responseData && typeof responseData.toString === 'function') {
                responseString = responseData.toString();
            } else {
                responseString = String(responseData || "Empty response");
            }
        } catch (convertError) {
            responseString = "Response conversion failed";
        }

        job.log(1, scriptName + ": Response data: " + responseString.substring(0, 200) + "...");

        // Response verarbeiten
        try {
            if (statusCode !== 200) {
                job.log(3, scriptName + ": HTTP Error " + statusCode + " - " + responseString);
                routeByName(s, job, errorName, scriptName);
                return;
            }

            // Auch bei Status 200 kann es Backend-Fehler geben
            if (responseString.indexOf('"error"') !== -1) {
                job.log(3, scriptName + ": Backend Error Response: " + responseString);
                routeByName(s, job, errorName, scriptName);
                return;
            }

            var result = JSON.parse(responseString);

            if (result.success) {
                    // Store approval information in private data
                    job.setPrivateData("ApprovalId", result.approvalId);
                    job.setPrivateData("ApprovalToken", result.token);
                    job.setPrivateData("ApprovalStatus", "pending");
                    job.setPrivateData("ApprovalSubmitTime", toISOString(new Date()));
                    job.log(1, scriptName + ": Approval created with ID " + result.approvalId);
                    job.log(1, scriptName + ": PDF uploaded via Switch HTTP API");
                    job.log(1, scriptName + ": Original PDF waits in Switch folder until webhook processes it");

                    // Send notification if configured
                    if (notificationEmail) {
                        sendNotification(s, job, notificationEmail, result.approvalId);
                    }

                    // Route to Success by NAME → Pending Folder
                    routeByName(s, job, successName, scriptName);
                } else {
                    job.log(3, scriptName + ": API returned unsuccessful response");  // 3 = Error
                    routeByName(s, job, errorName, scriptName);
                }

        } catch (parseError) {
            // SAFE ERROR HANDLING - kein Property-Zugriff
            job.log(3, scriptName + ": Error parsing API response - " + String(parseError || "Parse failed"));
            routeByName(s, job, errorName, scriptName);
        }

    } catch (error) {
        // SAFE ERROR HANDLING - kein Property-Zugriff
        job.log(3, scriptName + ": Error submitting approval - " + String(error || "Unknown error"));
        routeByName(s, job, "Error", scriptName);
    }
}

// Helper function - Switch ES5 Date ist problematisch, verwende einfachen String
function toISOString(date) {
    // Switch ES5 hat Date-Probleme - verwende einfachen Timestamp
    var timestamp = String(date || "unknown");
    return timestamp.replace(/\s/g, 'T') + 'Z';
}

// VEREINFACHTE Helper function to route by connection name
function routeByName(s, job, targetName, scriptName) {
    job.log(1, scriptName + ": Looking for connection named '" + targetName + "'");  // 1 = Info

    // Switch ES5 sendToData mit Pfad (int, QString, QString)
    var jobPath = job.getPath();

    if (targetName.toLowerCase() === "success") {
        job.log(1, scriptName + ": Routing to Success connection");
        job.sendToData(1, jobPath, "");  // sendToData(int, QString, QString)
        return;
    }

    if (targetName.toLowerCase() === "error") {
        job.log(1, scriptName + ": Routing to Error connection");
        job.sendToData(2, jobPath, "");  // sendToData(int, QString, QString)
        return;
    }

    // Fallback: Try to parse as number
    var connectionNum = parseInt(targetName, 10);
    if (!isNaN(connectionNum)) {
        job.log(1, scriptName + ": Using connection number " + connectionNum);
        job.sendToData(connectionNum, jobPath, "");
        return;
    }

    // Ultimate fallback
    job.log(2, scriptName + ": Could not find connection named '" + targetName + "', using Success");
    job.sendToData(1, jobPath, "");  // sendToData(int, QString, QString)
}

function sendNotification(s, job, email, approvalId) {
    try {
        var message = "PDF approval submitted:\n" +
            "File: " + job.getName() + "\n" +
            "Job ID: " + job.getName() + "\n" +
            "Approval ID: " + approvalId + "\n" +
            "Time: " + new Date().toLocaleString() + "\n\n" +
            "Note: PDF uploaded to server for customer review.\n" +
            "Original PDF remains in Switch workflow for processing.";

        s.sendEmail(email, "Approval Submitted", message);
    } catch (error) {
        // SAFE ERROR HANDLING
        job.log(2, "Failed to send notification: " + String(error || "Notification failed"));
    }
}