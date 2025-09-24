// Enfocus Switch Script: Submit PDF for Approval (Switch Compatible)
// This script sends PDF files to the ThammApprove system
// WICHTIG: Nutzt Named Connections mit ES5-kompatiblem Code!
// PDF wird an Server gesendet (für Kunde) UND in Switch behalten (für Workflow)

function jobArrived(s, job) {
    var scriptName = "ThammApprove Submit";

    try {
        // Get configuration from Switch flow element properties
        var apiUrl = s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        var customerEmail = s.getPropertyValue("customerEmail") || job.getPrivateData("CustomerEmail");
        var customerName = s.getPropertyValue("customerName") || job.getPrivateData("CustomerName");
        var notificationEmail = s.getPropertyValue("notificationEmail");

        // CONNECTION NAMES - können in Properties definiert werden
        var successName = s.getPropertyValue("successName") || "Success";
        var errorName = s.getPropertyValue("errorName") || "Error";

        // Validate required fields
        if (!customerEmail) {
            job.log(LogLevel.Error, scriptName + ": Customer email is required");
            routeByName(s, job, errorName, scriptName);
            return;
        }

        // Get job information
        var jobPath = job.getPath();
        var fileName = job.getName();
        var jobId = job.getUniqueId();

        // Prepare metadata
        var metadata = {
            submitTime: new Date().toISOString(),
            switchServer: s.getServerName(),
            flowName: s.getFlowName(),
            elementName: s.getElementName(),
            originalPath: jobPath,
            jobNumber: job.getJobNumber() || "",
            priority: job.getPriority() || "Normal"
        };

        // Add all private data as metadata
        var privateDataKeys = job.getPrivateDataKeys();
        for (var i = 0; i < privateDataKeys.length; i++) {
            var key = privateDataKeys[i];
            metadata["privateData_" + key] = job.getPrivateData(key);
        }

        // Submit to API using HTTP multipart
        job.log(LogLevel.Info, scriptName + ": Submitting " + fileName + " for approval");

        var http = new HTTP();
        var url = apiUrl + "/api/approvals/create";

        // Create multipart form data
        var formData = new FormData();
        formData.addFile("pdf", jobPath);
        formData.addField("jobId", jobId);
        formData.addField("customerEmail", customerEmail);
        formData.addField("customerName", customerName || "");
        formData.addField("switchFlowId", s.getFlowId() || "");
        formData.addField("switchJobId", job.getId() || "");
        formData.addField("metadata", JSON.stringify(metadata));

        http.post(url, formData, function(response) {
            try {
                if (response.statusCode !== 200) {
                    job.log(LogLevel.Error, scriptName + ": HTTP Error " + response.statusCode + " - " + response.body);
                    routeByName(s, job, errorName, scriptName);
                    return;
                }

                var result = JSON.parse(response.body);

                if (result.success) {
                    // Store approval information in private data
                    job.setPrivateData("ApprovalId", result.approvalId);
                    job.setPrivateData("ApprovalToken", result.token);
                    job.setPrivateData("ApprovalStatus", "pending");
                    job.setPrivateData("ApprovalSubmitTime", new Date().toISOString());
                    job.setPrivateData("ServerUploadPath", "/uploads/" + result.approvalId + ".pdf");

                    job.log(LogLevel.Info, scriptName + ": Approval created with ID " + result.approvalId);
                    job.log(LogLevel.Info, scriptName + ": PDF uploaded to server for customer viewing");
                    job.log(LogLevel.Info, scriptName + ": Original PDF stays in Switch for workflow processing");

                    // Send notification if configured
                    if (notificationEmail) {
                        sendNotification(s, job, notificationEmail, result.approvalId);
                    }

                    // IMPORTANT: PDF is now stored in TWO places:
                    // 1. ThammApprove Server (customer can view/approve in browser)
                    // 2. Switch Hold Element (original PDF for workflow processing)
                    // Route to Success by NAME → Hold Element
                    routeByName(s, job, successName, scriptName);
                } else {
                    job.log(LogLevel.Error, scriptName + ": API returned unsuccessful response");
                    routeByName(s, job, errorName, scriptName);
                }

            } catch (parseError) {
                job.log(LogLevel.Error, scriptName + ": Error parsing API response - " + parseError.message);
                routeByName(s, job, errorName, scriptName);
            }
        });

    } catch (error) {
        job.log(LogLevel.Error, scriptName + ": Error submitting approval - " + error.message);
        routeByName(s, job, errorName || "Error", scriptName);
    }
}

// Helper function to route by connection name (ES5 compatible)
function routeByName(s, job, targetName, scriptName) {
    // Get number of outgoing connections
    var numConnections = s.getOutgoingConnectionCount ? s.getOutgoingConnectionCount() : 10;

    job.log(LogLevel.Debug, scriptName + ": Looking for connection named '" + targetName + "'");

    // Check each connection by number and get its name
    for (var i = 1; i <= numConnections; i++) {
        try {
            var connectionName = s.getOutgoingName ? s.getOutgoingName(i) : null;

            if (connectionName) {
                job.log(LogLevel.Debug, scriptName + ": Connection " + i + " is named '" + connectionName + "'");

                // Check if this is our target (case-insensitive, trimmed) - ES5 trim
                if (connectionName.replace(/^\s+|\s+$/g, '').toLowerCase() === targetName.replace(/^\s+|\s+$/g, '').toLowerCase()) {
                    job.log(LogLevel.Info, scriptName + ": Routing to '" + targetName + "' via Connection " + i);
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
        job.log(LogLevel.Info, scriptName + ": Routing to Success connection");
        job.sendToData(Connection.Level.Success);
        return;
    }

    if (targetName.toLowerCase() === "error") {
        job.log(LogLevel.Info, scriptName + ": Routing to Error connection");
        job.sendToData(Connection.Level.Error);
        return;
    }

    // Fallback: Try to parse as number
    var connectionNum = parseInt(targetName, 10);
    if (!isNaN(connectionNum)) {
        job.log(LogLevel.Warning, scriptName + ": No connection named '" + targetName + "' found, using number " + connectionNum);
        job.sendToData(connectionNum);
        return;
    }

    // Ultimate fallback
    job.log(LogLevel.Error, scriptName + ": Could not find connection named '" + targetName + "', using Success");
    job.sendToData(Connection.Level.Success);
}

function sendNotification(s, job, email, approvalId) {
    try {
        var message = "PDF approval submitted:\n" +
            "File: " + job.getName() + "\n" +
            "Job ID: " + job.getUniqueId() + "\n" +
            "Approval ID: " + approvalId + "\n" +
            "Time: " + new Date().toLocaleString() + "\n\n" +
            "Note: PDF uploaded to server for customer review.\n" +
            "Original PDF remains in Switch workflow for processing.";

        s.sendEmail(email, "Approval Submitted", message);
    } catch (error) {
        job.log(LogLevel.Warning, "Failed to send notification: " + error.message);
    }
}