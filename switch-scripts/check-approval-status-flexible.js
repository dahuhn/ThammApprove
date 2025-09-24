// Enfocus Switch Script: Check Approval Status (Flexible Version mit Properties)
// Diese Version nutzt Script Properties für flexible Connection-Zuordnung

function jobArrived(s, job) {
    var scriptName = "ThammApprove Status Check (Flexible)";

    try {
        // Get configuration
        var apiUrl = s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        var checkInterval = s.getPropertyValue("checkInterval") || 60;
        var maxWaitTime = s.getPropertyValue("maxWaitTime") || 7200;

        // CONNECTION MAPPING aus Properties!
        // So können Sie die Nummern in Switch Properties ändern ohne das Script anzupassen
        var approvedConnection = parseInt(s.getPropertyValue("approvedConnection") || "1");
        var rejectedConnection = parseInt(s.getPropertyValue("rejectedConnection") || "2");
        var timeoutConnection = parseInt(s.getPropertyValue("timeoutConnection") || "3");
        var pendingConnection = s.getPropertyValue("pendingConnection") || "success";

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

                // Route nach Timeout
                job.log(LogLevel.Info, scriptName + ": Routing to TIMEOUT (Connection " + timeoutConnection + ")");
                job.sendToData(timeoutConnection);
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

                    // Bei Fehler: Route nach Pending für Retry
                    if (pendingConnection === "success") {
                        job.sendToData(Connection.Level.Success);
                    } else {
                        job.sendToData(parseInt(pendingConnection));
                    }
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

                    // Route nach Approved
                    job.log(LogLevel.Info, scriptName + ": Routing to APPROVED (Connection " + approvedConnection + ")");
                    job.sendToData(approvedConnection);

                } else if (approval.status === 'rejected') {
                    // Approval rejected
                    job.log(LogLevel.Warning, scriptName + ": REJECTED - " + (approval.rejectedReason || "no reason"));

                    // Store rejection details
                    job.setPrivateData("RejectedReason", approval.rejectedReason || "");
                    job.setPrivateData("RejectionComments", approval.comments || "");

                    // Route nach Rejected
                    job.log(LogLevel.Info, scriptName + ": Routing to REJECTED (Connection " + rejectedConnection + ")");
                    job.sendToData(rejectedConnection);

                } else {
                    // Still pending - hold the job
                    job.log(LogLevel.Info, scriptName + ": Still PENDING, will check again in " + checkInterval + " seconds");

                    // Route nach Pending (Loop)
                    job.log(LogLevel.Debug, scriptName + ": Routing to PENDING (Connection " + pendingConnection + ")");
                    if (pendingConnection === "success") {
                        job.sendToData(Connection.Level.Success);
                    } else if (pendingConnection === "error") {
                        job.sendToData(Connection.Level.Error);
                    } else {
                        job.sendToData(parseInt(pendingConnection));
                    }
                }

            } catch (parseError) {
                job.log(LogLevel.Error, scriptName + ": Error parsing response - " + parseError.message);

                // Bei Parse-Error: Route nach Pending für Retry
                if (pendingConnection === "success") {
                    job.sendToData(Connection.Level.Success);
                } else {
                    job.sendToData(parseInt(pendingConnection));
                }
            }
        });

    } catch (error) {
        job.log(LogLevel.Error, scriptName + ": Error checking status - " + error.message);

        // On error, keep job in queue for retry
        job.sendToData(Connection.Level.Success);
    }
}