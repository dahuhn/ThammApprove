// Enfocus Switch Script: Webhook Receiver with Hold Element Release
// This script processes webhooks and releases jobs from Hold Elements
// Use with Switch Webhook Element
// WICHTIG: Nutzt job.release() für Hold Element Integration!

function webhookReceived(s, request) {
    var scriptName = "ThammApprove Webhook (Hold Release)";

    try {
        // Parse the webhook payload
        var payload = JSON.parse(request.body);

        s.log(LogLevel.Info, scriptName + ": Received webhook for job " + payload.jobId);

        // Find the corresponding job in Switch (should be in Hold Element)
        var job = s.findJobByPrivateData("ApprovalId", payload.jobId);

        if (!job) {
            s.log(LogLevel.Warning, scriptName + ": No job found for approval ID " + payload.jobId);
            return {
                statusCode: 404,
                body: JSON.stringify({
                    error: "Job not found",
                    message: "Job may have timed out or already been processed"
                })
            };
        }

        // Check if job is actually held
        var jobState = job.getState();
        s.log(LogLevel.Debug, scriptName + ": Job " + payload.jobId + " current state: " + jobState);

        // Update job with approval results first (before routing)
        job.setPrivateData("ApprovalStatus", payload.status);
        job.setPrivateData("WebhookReceived", new Date().toISOString());

        if (payload.status === 'approved') {
            job.setPrivateData("ApprovedBy", payload.approvedBy || "");
            job.setPrivateData("ApprovedAt", payload.approvedAt || "");
            job.setPrivateData("ApprovalComments", payload.comments || "");

            job.log(LogLevel.Info, scriptName + ": Job approved by " + (payload.approvedBy || "unknown"));

            // Release job from Hold and route to Approved
            releaseAndRoute(s, job, "Approved", scriptName);

        } else if (payload.status === 'rejected') {
            job.setPrivateData("RejectedReason", payload.rejectedReason || "");
            job.setPrivateData("RejectionComments", payload.comments || "");
            job.setPrivateData("RejectedBy", payload.rejectedBy || "");
            job.setPrivateData("RejectedAt", payload.rejectedAt || "");

            job.log(LogLevel.Warning, scriptName + ": Job rejected - " + (payload.rejectedReason || "no reason"));

            // Release job from Hold and route to Rejected
            releaseAndRoute(s, job, "Rejected", scriptName);

        } else {
            job.log(LogLevel.Warning, scriptName + ": Unknown status received: " + payload.status);
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: "Invalid status",
                    message: "Status must be 'approved' or 'rejected'"
                })
            };
        }

        // Send success response
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: "Job released and routed to " + payload.status,
                jobId: payload.jobId
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

// Helper function to release job from Hold and route to target
function releaseAndRoute(s, job, targetConnection, scriptName) {
    try {
        // First, try to release the job from Hold
        var released = job.release();
        if (released) {
            job.log(LogLevel.Info, scriptName + ": Job released from Hold Element");
        } else {
            job.log(LogLevel.Warning, scriptName + ": Job was not in held state or release failed");
        }

        // Small delay to ensure release is processed
        // Note: Switch might need a moment to process the release

        // Route to target connection
        routeJobToConnection(s, job, targetConnection, scriptName);

    } catch (error) {
        job.log(LogLevel.Error, scriptName + ": Error releasing job - " + error.message);

        // Fallback: try routing without release
        routeJobToConnection(s, job, targetConnection, scriptName);
    }
}

// Helper function to route job to named connection
function routeJobToConnection(s, job, targetName, scriptName) {
    // Get number of outgoing connections from the Webhook Element
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
                    job.log(LogLevel.Info, scriptName + ": Routing job to '" + targetName + "' via Connection " + i);
                    job.sendToData(i);
                    return;
                }
            }
        } catch (e) {
            // Connection doesn't exist, continue
        }
    }

    // Fallback routing if named connection not found
    job.log(LogLevel.Warning, scriptName + ": No connection named '" + targetName + "' found");

    if (targetName.toLowerCase() === "approved") {
        job.log(LogLevel.Info, scriptName + ": Using fallback - routing to Connection 1");
        job.sendToData(1); // Assuming Connection 1 is Approved
    } else if (targetName.toLowerCase() === "rejected") {
        job.log(LogLevel.Info, scriptName + ": Using fallback - routing to Connection 2");
        job.sendToData(2); // Assuming Connection 2 is Rejected
    } else {
        // Ultimate fallback
        job.log(LogLevel.Error, scriptName + ": Could not route job, using Connection 1 as fallback");
        job.sendToData(1);
    }
}

// Alternative implementation for Switch WebServices module (ES5 compatible)
function processWebhook(s, xmlRequest) {
    var scriptName = "ThammApprove Webhook SOAP (Hold Release)";

    try {
        // Extract JSON from XML wrapper (if using SOAP)
        // Simplified XML parsing for ES5 compatibility
        var payloadMatch = xmlRequest.match(/<webhookData>(.*?)<\/webhookData>/);
        if (!payloadMatch) {
            throw new Error("No webhook data found in XML");
        }

        var payload = JSON.parse(payloadMatch[1]);

        s.log(LogLevel.Info, scriptName + ": Processing SOAP webhook for job " + payload.jobId);

        // Find and process job (same logic as HTTP version)
        var job = s.findJobByPrivateData("ApprovalId", payload.jobId);

        if (job) {
            job.setPrivateData("ApprovalStatus", payload.status);
            job.setPrivateData("WebhookReceived", new Date().toISOString());

            if (payload.status === 'approved') {
                job.setPrivateData("ApprovedBy", payload.approvedBy || "");
                job.setPrivateData("ApprovedAt", payload.approvedAt || "");
                job.setPrivateData("ApprovalComments", payload.comments || "");
                releaseAndRoute(s, job, "Approved", scriptName);
            } else if (payload.status === 'rejected') {
                job.setPrivateData("RejectedReason", payload.rejectedReason || "");
                job.setPrivateData("RejectionComments", payload.comments || "");
                releaseAndRoute(s, job, "Rejected", scriptName);
            }
        }

        // Create response XML
        var responseXml = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
                '<soap:Body>' +
                    '<WebhookResponse>' +
                        '<success>true</success>' +
                        '<message>Job released and processed</message>' +
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