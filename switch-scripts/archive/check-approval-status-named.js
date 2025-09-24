// Enfocus Switch Script: Check Approval Status (Named Connections Version)
// Diese Version nutzt Connection-NAMEN statt Nummern!

function jobArrived(s, job) {
    var scriptName = "ThammApprove Status Check (Named)";

    try {
        // Get configuration
        var apiUrl = s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        var checkInterval = s.getPropertyValue("checkInterval") || 60;
        var maxWaitTime = s.getPropertyValue("maxWaitTime") || 7200;

        // CONNECTION NAMES - Sie können diese in den Properties definieren
        // oder die Connections in Switch entsprechend benennen!
        var approvedName = s.getPropertyValue("approvedName") || "Approved";
        var rejectedName = s.getPropertyValue("rejectedName") || "Rejected";
        var timeoutName = s.getPropertyValue("timeoutName") || "Timeout";
        var pendingName = s.getPropertyValue("pendingName") || "Pending";

        // Get approval info from private data
        var jobId = job.getPrivateData("ApprovalId") || job.getUniqueId();
        var submitTime = job.getPrivateData("ApprovalSubmitTime");

        if (!jobId) {
            job.log(LogLevel.Error, scriptName + ": No approval ID found");
            job.sendToData(Connection.Level.Error);
            return;
        }

        // Check if max wait time exceeded
        if (submitTime) {
            var waitTime = (Date.now() - new Date(submitTime).getTime()) / 1000;
            if (waitTime > maxWaitTime) {
                job.log(LogLevel.Warning, scriptName + ": Max wait time exceeded (" + waitTime + "s > " + maxWaitTime + "s)");
                job.setPrivateData("ApprovalStatus", "timeout");

                // Route by NAME!
                routeByName(s, job, timeoutName, scriptName);
                return;
            }
        }

        // Check approval status via HTTP request
        job.log(LogLevel.Info, scriptName + ": Checking status for job " + jobId);

        var http = new HTTP();
        var url = apiUrl + "/api/approvals/status/" + jobId;

        http.get(url, function(response) {
            try {
                if (response.statusCode !== 200) {
                    job.log(LogLevel.Error, scriptName + ": HTTP Error " + response.statusCode);
                    routeByName(s, job, pendingName, scriptName);
                    return;
                }

                var approval = JSON.parse(response.body);

                // Update private data with latest status
                job.setPrivateData("ApprovalStatus", approval.status);
                job.setPrivateData("ApprovalLastCheck", new Date().toISOString());

                if (approval.status === 'approved') {
                    // Approval successful
                    job.log(LogLevel.Info, scriptName + ": APPROVED by " + (approval.approvedBy || "unknown"));

                    // Store approval details
                    job.setPrivateData("ApprovedBy", approval.approvedBy || "");
                    job.setPrivateData("ApprovedAt", approval.approvedAt || "");
                    job.setPrivateData("ApprovalComments", approval.comments || "");

                    // Route to Approved by NAME
                    routeByName(s, job, approvedName, scriptName);

                } else if (approval.status === 'rejected') {
                    // Approval rejected
                    job.log(LogLevel.Warning, scriptName + ": REJECTED - " + (approval.rejectedReason || "no reason"));

                    // Store rejection details
                    job.setPrivateData("RejectedReason", approval.rejectedReason || "");
                    job.setPrivateData("RejectionComments", approval.comments || "");

                    // Route to Rejected by NAME
                    routeByName(s, job, rejectedName, scriptName);

                } else {
                    // Still pending
                    job.log(LogLevel.Info, scriptName + ": Still PENDING, will check again in " + checkInterval + " seconds");

                    // Route to Pending by NAME
                    routeByName(s, job, pendingName, scriptName);
                }

            } catch (parseError) {
                job.log(LogLevel.Error, scriptName + ": Error parsing response - " + parseError.message);
                routeByName(s, job, pendingName, scriptName);
            }
        });

    } catch (error) {
        job.log(LogLevel.Error, scriptName + ": Error checking status - " + error.message);
        job.sendToData(Connection.Level.Success);
    }
}

// Helper function to route by connection name
function routeByName(s, job, targetName, scriptName) {
    // Get number of outgoing connections
    var numConnections = s.getOutgoingConnectionCount() || 10; // Fallback to 10

    job.log(LogLevel.Debug, scriptName + ": Looking for connection named '" + targetName + "'");

    // Check each connection by number and get its name
    for (var i = 1; i <= numConnections; i++) {
        try {
            var connectionName = s.getOutgoingName(i);

            if (connectionName) {
                job.log(LogLevel.Debug, scriptName + ": Connection " + i + " is named '" + connectionName + "'");

                // Check if this is our target (case-insensitive, trimmed)
                if (connectionName.trim().toLowerCase() === targetName.trim().toLowerCase()) {
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
    if (targetName.toLowerCase() === "success" || targetName.toLowerCase() === "pending") {
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
    var connectionNum = parseInt(targetName);
    if (!isNaN(connectionNum)) {
        job.log(LogLevel.Warning, scriptName + ": No connection named '" + targetName + "' found, using number " + connectionNum);
        job.sendToData(connectionNum);
        return;
    }

    // Ultimate fallback
    job.log(LogLevel.Error, scriptName + ": Could not find connection named '" + targetName + "', using Success");
    job.sendToData(Connection.Level.Success);
}