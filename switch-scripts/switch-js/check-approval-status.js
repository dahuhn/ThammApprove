// Enfocus Switch Script: Check Approval Status
// Modern JavaScript (no TypeScript) for Switch 2022+

async function jobArrived(s, job) {
    const scriptName = "ThammApprove Status Check";

    try {
        // Get configuration from Switch properties (direkt von s)
        const apiUrl = await s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        const checkIntervalStr = await s.getPropertyValue("checkInterval") || "60";
        const maxWaitTimeStr = await s.getPropertyValue("maxWaitTime") || "7200";

        const checkInterval = parseInt(checkIntervalStr);
        const maxWaitTime = parseInt(maxWaitTimeStr);

        // CONNECTION NAMES
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
            await job.sendToNull();
            return;
        }

        // Check if max wait time exceeded
        if (submitTime) {
            const waitTime = (Date.now() - new Date(submitTime).getTime()) / 1000;
            if (waitTime > maxWaitTime) {
                await job.log(LogLevel.Warning, `${scriptName}: Max wait time exceeded (${waitTime}s > ${maxWaitTime}s)`);
                await job.setPrivateData("ApprovalStatus", "timeout");
                // Route to Timeout (Connection 4)
                await job.sendToData(4);
                return;
            }
        }

        // Check approval status via HTTP request
        await job.log(LogLevel.Info, `${scriptName}: Checking status for job ${jobId}`);

        const http = require('http');
        const https = require('https');
        const url = new URL(`${apiUrl}/api/approvals/status/${jobId}`);

        // Make HTTP request
        const httpModule = url.protocol === 'https:' ? https : http;

        await new Promise((resolve, reject) => {
            const options = {
                method: 'GET',
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 3101),
                path: url.pathname,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Switch-ThammApprove/1.0'
                }
            };

            const req = httpModule.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', async () => {
                    try {
                        if (res.statusCode !== 200) {
                            await job.log(LogLevel.Error, `${scriptName}: HTTP Error ${res.statusCode}`);
                            // Route to Pending (Connection 3) for retry
                            await job.sendToData(3);
                            reject(new Error(`HTTP ${res.statusCode}`));
                            return;
                        }

                        const approval = JSON.parse(data);

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
                            const jobPath = await job.get(AccessLevel.ReadOnly);
                            await job.sendToSingle(jobPath);
                            resolve();

                        } else if (approval.status === 'rejected') {
                            // Approval rejected
                            await job.log(LogLevel.Warning, `${scriptName}: Rejected - ${approval.rejectedReason || "no reason"}`);

                            // Store rejection details
                            await job.setPrivateData("RejectedReason", approval.rejectedReason || "");
                            await job.setPrivateData("RejectionComments", approval.comments || "");

                            // Route to Rejected (Connection 2)
                            await job.sendToData(2);
                            resolve();

                        } else {
                            // Still pending - hold the job
                            await job.log(LogLevel.Info, `${scriptName}: Still pending, will check again in ${checkInterval} seconds`);

                            // Route to Pending (Connection 3) for retry
                            await job.sendToData(3);
                            resolve();
                        }

                    } catch (parseError) {
                        await job.log(LogLevel.Error, `${scriptName}: Error parsing response - ${parseError.message}`);
                        // Route to Pending for retry
                        await job.sendToData(3);
                        reject(parseError);
                    }
                });
            });

            req.on('error', async (error) => {
                await job.log(LogLevel.Error, `${scriptName}: HTTP request failed - ${error.message}`);
                // Route to Pending for retry
                await job.sendToData(3);
                reject(error);
            });

            req.end();
        });

    } catch (error) {
        await job.log(LogLevel.Error, `${scriptName}: Error checking status - ${error.message}`);
        await job.sendToNull();
    }
}