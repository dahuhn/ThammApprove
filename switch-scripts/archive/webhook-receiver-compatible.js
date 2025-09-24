// Enfocus Switch Script: Webhook Receiver (Switch Compatible)
// This script processes webhook callbacks from the approval system
// Use with Switch HTTP Server element
// WICHTIG: Nutzt Named Connections mit ES5-kompatiblem Code!

function webhookReceived(s, request) {
    var scriptName = "ThammApprove Webhook (Compatible)";

    try {
        // CONNECTION NAMES - können in Properties definiert werden
        var approvedFolderName = s.getPropertyValue("approvedFolderName") || "Approved";
        var rejectedFolderName = s.getPropertyValue("rejectedFolderName") || "Rejected";

        // Parse the webhook payload
        var payload = JSON.parse(request.body);

        s.log(LogLevel.Info, scriptName + ": Received webhook for job " + payload.jobId);

        // Find the corresponding job in Switch
        var job = s.findJobByPrivateData("ApprovalId", payload.jobId);

        if (!job) {
            s.log(LogLevel.Warning, scriptName + ": No job found for approval ID " + payload.jobId);
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Job not found" })
            };
        }

        // Update job with approval results
        job.setPrivateData("ApprovalStatus", payload.status);
        job.setPrivateData("WebhookReceived", new Date().toISOString());

        if (payload.status === 'approved') {
            job.setPrivateData("ApprovedBy", payload.approvedBy || "");
            job.setPrivateData("ApprovedAt", payload.approvedAt || "");
            job.setPrivateData("ApprovalComments", payload.comments || "");

            job.log(LogLevel.Info, scriptName + ": Job approved by " + payload.approvedBy);

            // Move job to approved folder using named connection
            moveToNamedFolder(s, job, approvedFolderName, scriptName);

        } else if (payload.status === 'rejected') {
            job.setPrivateData("RejectedReason", payload.rejectedReason || "");
            job.setPrivateData("RejectionComments", payload.comments || "");

            job.log(LogLevel.Warning, scriptName + ": Job rejected - " + payload.rejectedReason);

            // Move job to rejected folder using named connection
            moveToNamedFolder(s, job, rejectedFolderName, scriptName);
        }

        // Send success response
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: "Webhook processed successfully"
            })
        };

    } catch (error) {
        s.log(LogLevel.Error, scriptName + ": Error processing webhook - " + error.message);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Internal server error",
                message: error.message
            })
        };
    }
}

// Helper function to move job to named folder/connection (ES5 compatible)
function moveToNamedFolder(s, job, folderName, scriptName) {
    job.log(LogLevel.Debug, scriptName + ": Moving job to folder '" + folderName + "'");

    // Try to find a folder with the given name
    try {
        // First check if it's a special folder name
        if (folderName.toLowerCase() === "approved") {
            var approvedFolder = s.getApprovedFolder ? s.getApprovedFolder() : null;
            if (approvedFolder) {
                job.moveTo(approvedFolder);
                job.log(LogLevel.Info, scriptName + ": Moved to approved folder");
                return;
            }
        }

        if (folderName.toLowerCase() === "rejected") {
            var rejectedFolder = s.getRejectedFolder ? s.getRejectedFolder() : null;
            if (rejectedFolder) {
                job.moveTo(rejectedFolder);
                job.log(LogLevel.Info, scriptName + ": Moved to rejected folder");
                return;
            }
        }

        // Otherwise, try routing by connection name
        routeByName(s, job, folderName, scriptName);

    } catch (error) {
        job.log(LogLevel.Error, scriptName + ": Error moving to folder '" + folderName + "' - " + error.message);
        // Fallback: route to success
        job.sendToData(Connection.Level.Success);
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

// Alternative implementation for Switch WebServices module (ES5 compatible)
function processWebhook(s, xmlRequest) {
    var scriptName = "ThammApprove Webhook SOAP (Compatible)";

    try {
        // CONNECTION NAMES
        var approvedFolderName = s.getPropertyValue("approvedFolderName") || "Approved";
        var rejectedFolderName = s.getPropertyValue("rejectedFolderName") || "Rejected";

        // Extract JSON from XML wrapper (if using SOAP)
        // Simplified XML parsing for ES5 compatibility
        var payloadMatch = xmlRequest.match(/<webhookData>(.*?)<\/webhookData>/);
        if (!payloadMatch) {
            throw new Error("No webhook data found in XML");
        }

        var payload = JSON.parse(payloadMatch[1]);

        s.log(LogLevel.Info, scriptName + ": Processing webhook for job " + payload.jobId);

        // Find and update job
        var job = s.findJobByPrivateData("ApprovalId", payload.jobId);

        if (job) {
            job.setPrivateData("ApprovalStatus", payload.status);
            job.setPrivateData("WebhookReceived", new Date().toISOString());

            if (payload.status === 'approved') {
                job.setPrivateData("ApprovedBy", payload.approvedBy || "");
                job.setPrivateData("ApprovedAt", payload.approvedAt || "");
                job.setPrivateData("ApprovalComments", payload.comments || "");
                moveToNamedFolder(s, job, approvedFolderName, scriptName);
            } else if (payload.status === 'rejected') {
                job.setPrivateData("RejectedReason", payload.rejectedReason || "");
                job.setPrivateData("RejectionComments", payload.comments || "");
                moveToNamedFolder(s, job, rejectedFolderName, scriptName);
            }
        }

        // Create response XML
        var responseXml = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
                '<soap:Body>' +
                    '<WebhookResponse>' +
                        '<success>true</success>' +
                        '<message>Processed</message>' +
                    '</WebhookResponse>' +
                '</soap:Body>' +
            '</soap:Envelope>';

        return responseXml;

    } catch (error) {
        s.log(LogLevel.Error, scriptName + ": Webhook error - " + error.message);

        var errorXml = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
                '<soap:Body>' +
                    '<soap:Fault>' +
                        '<faultcode>Server</faultcode>' +
                        '<faultstring>' + error.message + '</faultstring>' +
                    '</soap:Fault>' +
                '</soap:Body>' +
            '</soap:Envelope>';

        return errorXml;
    }
}