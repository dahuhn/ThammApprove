// Enfocus Switch Script: Check Approval Status
// This script checks the status of a pending approval

async function jobArrived(s, job) {
    const scriptName = "ThammApprove Status Check";

    try {
        // Get configuration
        const apiUrl = await s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        const checkInterval = await s.getPropertyValue("checkInterval") || 60; // seconds
        const maxWaitTime = await s.getPropertyValue("maxWaitTime") || 7200; // seconds (2 hours default)

        // Get approval info from private data
        const jobId = await job.getPrivateData("ApprovalId") || await job.getUniqueId();
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
                await job.sendToData(3); // Send to timeout connection
                return;
            }
        }

        // Check approval status via API
        const axios = require('axios');

        await job.log(LogLevel.Info, `${scriptName}: Checking status for job ${jobId}`);

        const response = await axios.get(
            `${apiUrl}/api/approvals/status/${jobId}`,
            { timeout: 10000 }
        );

        const approval = response.data;

        // Update private data with latest status
        await job.setPrivateData("ApprovalStatus", approval.status);
        await job.setPrivateData("ApprovalLastCheck", new Date().toISOString());

        if (approval.status === 'approved') {
            // Approval successful
            await job.log(LogLevel.Info, `${scriptName}: Approved by ${approval.approvedBy}`);

            // Store approval details
            await job.setPrivateData("ApprovedBy", approval.approvedBy || "");
            await job.setPrivateData("ApprovedAt", approval.approvedAt || "");
            await job.setPrivateData("ApprovalComments", approval.comments || "");

            // Send to approved connection
            await job.sendToData(1); // Connection 1 = Approved

        } else if (approval.status === 'rejected') {
            // Approval rejected
            await job.log(LogLevel.Warning, `${scriptName}: Rejected - ${approval.rejectedReason}`);

            // Store rejection details
            await job.setPrivateData("RejectedReason", approval.rejectedReason || "");
            await job.setPrivateData("RejectionComments", approval.comments || "");

            // Send to rejected connection
            await job.sendToData(2); // Connection 2 = Rejected

        } else {
            // Still pending - hold the job
            await job.log(LogLevel.Info, `${scriptName}: Still pending, will check again in ${checkInterval} seconds`);

            // Hold job for retry
            // In Switch, this typically means sending back to a hold folder
            // or using a timer element
            await job.sendToData(Connection.Level.Success); // Stay in loop
        }

    } catch (error) {
        await job.log(LogLevel.Error, `${scriptName}: Error checking status - ${error.message}`);

        // On error, keep job in queue for retry
        await job.sendToData(Connection.Level.Success);
    }
}