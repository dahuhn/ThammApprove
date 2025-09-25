// Enfocus Switch Script: Submit PDF for Approval (ES5 Compatible + Multipart Upload)
// This script sends PDF files to the ThammApprove system
// WICHTIG: Nutzt Named Connections mit ES5-kompatiblem Code!
// PDF wird an Server gesendet (für Kunde) UND in Switch behalten (für Workflow)

function jobArrived(s, job) {
    var scriptName = "ThammApprove Submit";

    try {
        // Get configuration from Switch flow element properties (KORREKTE API)
        var apiUrl = s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        job.log(1, scriptName + ": Using API URL: " + apiUrl);  // 1 = Info
        var customerEmail = s.getPropertyValue("customerEmail") || job.getPrivateData("CustomerEmail");
        var customerName = s.getPropertyValue("customerName") || job.getPrivateData("CustomerName");
        var notificationEmail = s.getPropertyValue("notificationEmail");

        // CONNECTION NAMES - können in Properties definiert werden
        var successName = s.getPropertyValue("successName") || "Success";
        var errorName = s.getPropertyValue("errorName") || "Error";

        // Validate required fields
        if (!customerEmail) {
            job.log(3, scriptName + ": Customer email is required");  // 3 = Error
            routeByName(s, job, errorName, scriptName);
            return;
        }

        // Get job information
        var jobPath = job.getPath();
        var fileName = job.getName();
        var jobId = job.getName() + "_" + new Date().getTime();

        job.log(1, scriptName + ": Processing " + fileName + " (Path: " + jobPath + ")");

        // Store original filename for webhook processing
        job.setPrivateData("OriginalFileName", fileName);

        // Submit to API using HTTP multipart (PDF muss zum Backend für Anzeige!)
        job.log(1, scriptName + ": Submitting " + fileName + " for approval");

        var http = new HTTP();
        var url = apiUrl + "/api/approvals/create";  // ORIGINAL MULTIPART API

        // Create multipart form data (PDF wird hochgeladen)
        var formData = new FormData();
        formData.addFile("pdf", jobPath);
        formData.addField("jobId", jobId);
        formData.addField("fileName", fileName);
        formData.addField("customerEmail", customerEmail);
        formData.addField("customerName", customerName || "");
        formData.addField("switchFlowId", s.getFlowId() || "");
        formData.addField("switchJobId", jobId || "");
        formData.addField("metadata", JSON.stringify({
            submitTime: toISOString(new Date()),
            originalPath: jobPath
        }));

        // HTTP POST mit FormData
        http.post(url, formData, function(response) {
            try {
                if (response.statusCode !== 200) {
                    job.log(3, scriptName + ": HTTP Error " + response.statusCode + " - " + response.body);
                    routeByName(s, job, errorName, scriptName);
                    return;
                }

                var result = JSON.parse(response.body);

                if (result.success) {
                    // Store approval information in private data
                    job.setPrivateData("ApprovalId", result.approvalId);
                    job.setPrivateData("ApprovalToken", result.token);
                    job.setPrivateData("ApprovalStatus", "pending");
                    job.setPrivateData("ApprovalSubmitTime", toISOString(new Date()));

                    job.log(1, scriptName + ": Approval created with ID " + result.approvalId);
                    job.log(1, scriptName + ": PDF uploaded to server for customer viewing");
                    job.log(1, scriptName + ": Original PDF waits in Switch folder until webhook processes it");

                    // Send notification if configured
                    if (notificationEmail) {
                        sendNotification(s, job, notificationEmail, result.approvalId);
                    }

                    // WICHTIG: PDF bleibt in Switch, nur Metadaten wurden gesendet
                    // Route to Success by NAME → Pending Folder
                    routeByName(s, job, successName, scriptName);
                } else {
                    job.log(3, scriptName + ": API returned error: " + (result.error || "Unknown error"));
                    routeByName(s, job, errorName, scriptName);
                }

            } catch (parseError) {
                job.log(3, scriptName + ": Parse error - " + String(parseError || "Unknown parse error"));
                routeByName(s, job, errorName, scriptName);
            }
        });

    } catch (error) {
        job.log(3, scriptName + ": Fatal error - " + String(error || "Unknown error"));
        routeByName(s, job, "Error", scriptName);
    }
}

// Helper function for ES5-compatible ISO date string
function toISOString(date) {
    function pad(n) {
        return n < 10 ? '0' + n : n;
    }
    return date.getFullYear() + '-' +
        pad(date.getMonth() + 1) + '-' +
        pad(date.getDate()) + 'T' +
        pad(date.getHours()) + ':' +
        pad(date.getMinutes()) + ':' +
        pad(date.getSeconds()) + 'Z';
}

// Helper function to route by connection name (ES5 compatible)
function routeByName(s, job, targetName, scriptName) {
    // Get number of outgoing connections
    var numConnections = s.getOutgoingConnectionCount ? s.getOutgoingConnectionCount() : 10;

    job.log(1, scriptName + ": Looking for connection named '" + targetName + "'");

    // Check each connection by number and get its name
    for (var i = 1; i <= numConnections; i++) {
        try {
            var connectionName = s.getOutgoingName ? s.getOutgoingName(i) : null;

            if (connectionName) {
                job.log(1, scriptName + ": Connection " + i + " is named '" + connectionName + "'");

                // Check if this is our target (case-insensitive, trimmed) - ES5 trim
                if (connectionName.replace(/^\s+|\s+$/g, '').toLowerCase() === targetName.replace(/^\s+|\s+$/g, '').toLowerCase()) {
                    job.log(1, scriptName + ": Routing to '" + targetName + "' via Connection " + i);
                    job.sendToData(i);
                    return;
                }
            }
        } catch (e) {
            // Connection doesn't exist, continue
        }
    }

    // Check special connections
    if (targetName.toLowerCase() === "success") {
        job.log(1, scriptName + ": Routing to Success connection");
        job.sendToData(Connection.Level.Success);
        return;
    }

    if (targetName.toLowerCase() === "error") {
        job.log(1, scriptName + ": Routing to Error connection");
        job.sendToData(Connection.Level.Error);
        return;
    }

    // Fallback: Try to parse as number
    var connectionNum = parseInt(targetName, 10);
    if (!isNaN(connectionNum)) {
        job.log(2, scriptName + ": No connection named '" + targetName + "' found, using number " + connectionNum);
        job.sendToData(connectionNum);
        return;
    }

    // Ultimate fallback
    job.log(3, scriptName + ": Could not find connection named '" + targetName + "', using Success");
    job.sendToData(Connection.Level.Success);
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
        job.log(2, "Failed to send notification: " + String(error || "Unknown error"));
    }
}