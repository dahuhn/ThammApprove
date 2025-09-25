// Enfocus Switch Script: Check Approval Status
// Vollständig angepasst für offizielle Switch TypeScript Definitionen

interface ApprovalResponse {
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
    approvedAt?: string;
    rejectedBy?: string;
    rejectedReason?: string;
    comments?: string;
}

async function jobArrived(s: Switch, job: Job): Promise<void> {
    const scriptName = "ThammApprove Status Check";

    try {
        // Get configuration
        const apiUrl = await s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        const checkIntervalStr = await s.getPropertyValue("checkInterval") || "60";
        const maxWaitTimeStr = await s.getPropertyValue("maxWaitTime") || "7200";

        const checkInterval = parseInt(checkIntervalStr);
        const maxWaitTime = parseInt(maxWaitTimeStr);

        // CONNECTION NAMES - können in Properties definiert werden
        const approvedName = await s.getPropertyValue("approvedName") || "Approved";
        const rejectedName = await s.getPropertyValue("rejectedName") || "Rejected";
        const timeoutName = await s.getPropertyValue("timeoutName") || "Timeout";
        const pendingName = await s.getPropertyValue("pendingName") || "Pending";

        // Get approval info from private data
        const fileName = await job.getName();
        const jobId = await job.getPrivateData("ApprovalId") || `${fileName}_${Date.now()}`;
        const submitTime = await job.getPrivateData("ApprovalSubmitTime");

        if (!jobId) {
            await job.log(LogLevel.Error, `${scriptName}: No approval ID found`);
            await job.sendToData(Connection.Level.Error);
            return;
        }

        // Check if max wait time exceeded
        if (submitTime) {
            const waitTime = (Date.now() - new Date(submitTime).getTime()) / 1000;
            if (waitTime > maxWaitTime) {
                await job.log(LogLevel.Warning, `${scriptName}: Max wait time exceeded (${waitTime}s > ${maxWaitTime}s)`);
                await job.setPrivateData("ApprovalStatus", "timeout");
                // Route to Timeout (Connection 4)
                await job.sendToData(4 as any);
                return;
            }
        }

        // Check approval status via HTTP request
        await job.log(LogLevel.Info, `${scriptName}: Checking status for job ${jobId}`);

        const http = s.createHttpConnection();
        const url = `${apiUrl}/api/approvals/status/${jobId}`;

        try {
            const response = await http.get(url);

            if (response.statusCode !== 200) {
                await job.log(LogLevel.Error, `${scriptName}: HTTP Error ${response.statusCode}`);
                // Route to Pending (Connection 3)
                await job.sendToData(3 as any);
                return;
            }

            const approval: ApprovalResponse = JSON.parse(response.body);

            // Update private data with latest status
            await job.setPrivateData("ApprovalStatus", approval.status);
            await job.setPrivateData("ApprovalLastCheck", new Date().toISOString());

            if (approval.status === 'approved') {
                // Approval successful
                await job.log(LogLevel.Info, `${scriptName}: Approved by ${approval.approvedBy || "unknown"}`);

                // Store approval details
                await job.setPrivateData("ApprovedBy", approval.approvedBy || "");
                await job.setPrivateData("ApprovedAt", approval.approvedAt || "");
                await job.setPrivateData("ApprovalComments", approval.comments || "");

                // Route to Approved (Connection 1)
                await job.sendToData(1 as any);

            } else if (approval.status === 'rejected') {
                // Approval rejected
                await job.log(LogLevel.Warning, `${scriptName}: Rejected - ${approval.rejectedReason || "no reason"}`);

                // Store rejection details
                await job.setPrivateData("RejectedReason", approval.rejectedReason || "");
                await job.setPrivateData("RejectionComments", approval.comments || "");

                // Route to Rejected (Connection 2)
                await job.sendToData(2 as any);

            } else {
                // Still pending - hold the job
                await job.log(LogLevel.Info, `${scriptName}: Still pending, will check again in ${checkInterval} seconds`);

                // Route to Pending (Connection 3)
                await job.sendToData(3 as any);
            }

        } catch (httpError: any) {
            await job.log(LogLevel.Error, `${scriptName}: HTTP request failed - ${httpError.message}`);
            // Route to Pending for retry
            await job.sendToData(3 as any);
        }

    } catch (error: any) {
        await job.log(LogLevel.Error, `${scriptName}: Error checking status - ${error.message}`);
        await job.sendToData(Connection.Level.Error);
    }
}