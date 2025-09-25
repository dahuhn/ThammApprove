// Enfocus Switch Script: Check Approval Status (TypeScript)
// This script checks the status of a pending approval
// Uses modern TypeScript features for Switch 2022 Fall+

interface ApprovalResponse {
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
    approvedAt?: string;
    rejectedBy?: string;
    rejectedReason?: string;
    comments?: string;
}

function jobArrived(s: Switch, job: Job): void {
    const scriptName = "ThammApprove Status Check";

    try {
        // Get configuration
        const apiUrl = s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        const checkInterval = parseInt(s.getPropertyValue("checkInterval") || "60"); // seconds
        const maxWaitTime = parseInt(s.getPropertyValue("maxWaitTime") || "7200"); // seconds (2 hours default)

        // CONNECTION NAMES - können in Properties definiert werden
        const approvedName = s.getPropertyValue("approvedName") || "Approved";
        const rejectedName = s.getPropertyValue("rejectedName") || "Rejected";
        const timeoutName = s.getPropertyValue("timeoutName") || "Timeout";
        const pendingName = s.getPropertyValue("pendingName") || "Pending";

        // Get approval info from private data
        const jobId = job.getPrivateData("ApprovalId") || `${job.getName()}_${Date.now()}`;
        const submitTime = job.getPrivateData("ApprovalSubmitTime");

        if (!jobId) {
            job.log(LogLevel.Error, `${scriptName}: No approval ID found`);
            job.sendToData(Connection.Level.Error);
            return;
        }

        // Check if max wait time exceeded
        if (submitTime) {
            const waitTime = (Date.now() - new Date(submitTime).getTime()) / 1000;
            if (waitTime > maxWaitTime) {
                job.log(LogLevel.Warning, `${scriptName}: Max wait time exceeded (${waitTime}s > ${maxWaitTime}s)`);
                job.setPrivateData("ApprovalStatus", "timeout");
                // Route by NAME!
                routeByName(s, job, timeoutName, scriptName);
                return;
            }
        }

        // Check approval status via HTTP request
        job.log(LogLevel.Info, `${scriptName}: Checking status for job ${jobId}`);

        const http = new HTTP();
        const url = `${apiUrl}/api/approvals/status/${jobId}`;

        http.get(url, (response: HTTPResponse) => {
            try {
                if (response.statusCode !== 200) {
                    job.log(LogLevel.Error, `${scriptName}: HTTP Error ${response.statusCode}`);
                    routeByName(s, job, pendingName, scriptName);
                    return;
                }

                const approval: ApprovalResponse = JSON.parse(response.body);

                // Update private data with latest status
                job.setPrivateData("ApprovalStatus", approval.status);
                job.setPrivateData("ApprovalLastCheck", new Date().toISOString());

                if (approval.status === 'approved') {
                    // Approval successful
                    job.log(LogLevel.Info, `${scriptName}: Approved by ${approval.approvedBy || "unknown"}`);

                    // Store approval details
                    job.setPrivateData("ApprovedBy", approval.approvedBy || "");
                    job.setPrivateData("ApprovedAt", approval.approvedAt || "");
                    job.setPrivateData("ApprovalComments", approval.comments || "");

                    // Route to Approved by NAME
                    routeByName(s, job, approvedName, scriptName);

                } else if (approval.status === 'rejected') {
                    // Approval rejected
                    job.log(LogLevel.Warning, `${scriptName}: Rejected - ${approval.rejectedReason || "no reason"}`);

                    // Store rejection details
                    job.setPrivateData("RejectedReason", approval.rejectedReason || "");
                    job.setPrivateData("RejectionComments", approval.comments || "");

                    // Route to Rejected by NAME
                    routeByName(s, job, rejectedName, scriptName);

                } else {
                    // Still pending - hold the job
                    job.log(LogLevel.Info, `${scriptName}: Still pending, will check again in ${checkInterval} seconds`);

                    // Route to Pending by NAME
                    routeByName(s, job, pendingName, scriptName);
                }

            } catch (parseError: any) {
                job.log(LogLevel.Error, `${scriptName}: Error parsing response - ${parseError.message}`);
                routeByName(s, job, pendingName, scriptName);
            }
        });

    } catch (error: any) {
        job.log(LogLevel.Error, `${scriptName}: Error checking status - ${error.message}`);
        job.sendToData(Connection.Level.Success);
    }
}

// Helper function to route by connection name (TypeScript)
function routeByName(s: Switch, job: Job, targetName: string, scriptName: string): void {
    // Get number of outgoing connections
    const numConnections = s.getOutgoingConnectionCount?.() || 10;

    job.log(LogLevel.Debug, `${scriptName}: Looking for connection named '${targetName}'`);

    // Check each connection by number and get its name
    for (let i = 1; i <= numConnections; i++) {
        try {
            const connectionName = s.getOutgoingName?.(i);

            if (connectionName) {
                job.log(LogLevel.Debug, `${scriptName}: Connection ${i} is named '${connectionName}'`);

                // Check if this is our target (case-insensitive, trimmed)
                if (connectionName.trim().toLowerCase() === targetName.trim().toLowerCase()) {
                    job.log(LogLevel.Info, `${scriptName}: Routing to '${targetName}' via Connection ${i}`);
                    job.sendToData(i);
                    return;
                }
            }
        } catch (e) {
            // Connection doesn't exist, continue
        }
    }

    // Fallback to numbered connections if name not found
    job.log(LogLevel.Warning, `${scriptName}: No connection named '${targetName}' found, using fallback`);

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