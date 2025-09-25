// Enfocus Switch Script: Check Approval Status (Switch Compatible)
// This script checks the status of a pending approval
// WICHTIG: Nutzt Named Connections mit ES5-kompatiblem Code!

function jobArrived(s, job) {
    var scriptName = "ThammApprove Status Check";

    try {
        // Get configuration
        var apiUrl = s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        var checkInterval = s.getPropertyValue("checkInterval") || 60; // seconds
        var maxWaitTime = s.getPropertyValue("maxWaitTime") || 7200; // seconds (2 hours default)

        // CONNECTION NAMES - können in Properties definiert werden
        var approvedName = s.getPropertyValue("approvedName") || "Approved";
        var rejectedName = s.getPropertyValue("rejectedName") || "Rejected";
        var timeoutName = s.getPropertyValue("timeoutName") || "Timeout";
        var pendingName = s.getPropertyValue("pendingName") || "Pending";

        // Get approval info from private data
        var jobId = job.getPrivateData("ApprovalId") || (job.getName() + "_" + new Date().getTime());
        var submitTime = job.getPrivateData("ApprovalSubmitTime");

        if (!jobId) {
            job.log(3, scriptName + ": No approval ID found");  // 3 = Error
            job.sendToData(Connection.Level.Error);
            return;
        }

        // Check if max wait time exceeded
        if (submitTime) {
            var waitTime = (Date.now() - new Date(submitTime).getTime()) / 1000;
            if (waitTime > maxWaitTime) {
                job.log(2, scriptName + ": Max wait time exceeded (" + waitTime + "s > " + maxWaitTime + "s)");  // 2 = Warning
                job.setPrivateData("ApprovalStatus", "timeout");
                // Route by NAME!
                routeByName(s, job, timeoutName, scriptName);
                return;
            }
        }

        // Check approval status via HTTP request
        job.log(1, scriptName + ": Checking status for job " + jobId);  // 1 = Info

        var http = new HTTP();
        var url = apiUrl + "/api/approvals/status/" + jobId;

        http.get(url, function(response) {
            try {
                if (response.statusCode !== 200) {
                    job.log(3, scriptName + ": HTTP Error " + response.statusCode);  // 3 = Error
                    routeByName(s, job, pendingName, scriptName);
                    return;
                }

                var approval = JSON.parse(response.body);

                // Update private data with latest status
                job.setPrivateData("ApprovalStatus", approval.status);
                job.setPrivateData("ApprovalLastCheck", toISOString(new Date()));

                if (approval.status === 'approved') {
                    // Approval successful
                    job.log(1, scriptName + ": Approved by " + (approval.approvedBy || "unknown"));  // 1 = Info

                    // Store approval details
                    job.setPrivateData("ApprovedBy", approval.approvedBy || "");
                    job.setPrivateData("ApprovedAt", approval.approvedAt || "");
                    job.setPrivateData("ApprovalComments", approval.comments || "");

                    // Route to Approved by NAME
                    routeByName(s, job, approvedName, scriptName);

                } else if (approval.status === 'rejected') {
                    // Approval rejected
                    job.log(2, scriptName + ": Rejected - " + (approval.rejectedReason || "no reason"));  // 2 = Warning

                    // Store rejection details
                    job.setPrivateData("RejectedReason", approval.rejectedReason || "");
                    job.setPrivateData("RejectionComments", approval.comments || "");

                    // Route to Rejected by NAME
                    routeByName(s, job, rejectedName, scriptName);

                } else {
                    // Still pending - hold the job
                    job.log(1, scriptName + ": Still pending, will check again in " + checkInterval + " seconds");  // 1 = Info

                    // Route to Pending by NAME
                    routeByName(s, job, pendingName, scriptName);
                }

            } catch (parseError) {
                job.log(3, scriptName + ": Error parsing response - " + parseError.message);  // 3 = Error
                routeByName(s, job, pendingName, scriptName);
            }
        });

    } catch (error) {
        job.log(3, scriptName + ": Error checking status - " + error.message);  // 3 = Error
        job.sendToData(Connection.Level.Success);
    }
}

// Helper function for ES5-compatible ISO date string (toISOString not available)
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

    job.log(1, scriptName + ": Looking for connection named '" + targetName + "'");  // 1 = Info (Debug->Info)

    // Check each connection by number and get its name
    for (var i = 1; i <= numConnections; i++) {
        try {
            var connectionName = s.getOutgoingName ? s.getOutgoingName(i) : null;

            if (connectionName) {
                job.log(1, scriptName + ": Connection " + i + " is named '" + connectionName + "'");  // 1 = Info (Debug->Info)

                // Check if this is our target (case-insensitive, trimmed)
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

    // Fallback to numbered connections if name not found
    job.log(2, scriptName + ": No connection named '" + targetName + "' found, using fallback");  // 2 = Warning

    if (targetName.toLowerCase() === "approved") {
        job.sendToData(1); // Connection 1
    } else if (targetName.toLowerCase() === "rejected") {
        job.sendToData(2); // Connection 2
    } else if (targetName.toLowerCase() === "timeout") {
        job.sendToData(3); // Connection 3
    } else if (targetName.toLowerCase() === "pending" || targetName.toLowerCase() === "success") {
        job.sendToData(Connection.Level.Success);
    } else if (targetName.toLowerCase() === "error") {
        job.sendToData(Connection.Level.Error);
    } else {
        // Ultimate fallback
        job.sendToData(Connection.Level.Success);
    }
}