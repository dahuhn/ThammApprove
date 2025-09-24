// Enfocus Switch Script: Submit PDF for Approval
// This script sends PDF files to the ThammApprove system

async function jobArrived(s, job) {
    const scriptName = "ThammApprove Submit";

    try {
        // Get configuration from Switch flow element properties
        const apiUrl = await s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        const customerEmail = await s.getPropertyValue("customerEmail") || job.getPrivateData("CustomerEmail");
        const customerName = await s.getPropertyValue("customerName") || job.getPrivateData("CustomerName");
        const notificationEmail = await s.getPropertyValue("notificationEmail");

        // Validate required fields
        if (!customerEmail) {
            await job.log(LogLevel.Error, `${scriptName}: Customer email is required`);
            await job.sendToData(Connection.Level.Error);
            return;
        }

        // Get job information
        const jobPath = await job.getPath();
        const fileName = await job.getName();
        const jobId = await job.getUniqueId();

        // Prepare metadata
        const metadata = {
            submitTime: new Date().toISOString(),
            switchServer: await s.getServerName(),
            flowName: await s.getFlowName(),
            elementName: await s.getElementName(),
            originalPath: jobPath,
            jobNumber: await job.getJobNumber() || "",
            priority: await job.getPriority() || "Normal"
        };

        // Add all private data as metadata
        const privateDataKeys = await job.getPrivateDataKeys();
        for (const key of privateDataKeys) {
            metadata[`privateData_${key}`] = await job.getPrivateData(key);
        }

        // Create form data for upload
        const FormData = require('form-data');
        const fs = require('fs');
        const axios = require('axios');

        const formData = new FormData();
        formData.append('pdf', fs.createReadStream(jobPath));
        formData.append('jobId', jobId);
        formData.append('customerEmail', customerEmail);
        formData.append('customerName', customerName || '');
        formData.append('switchFlowId', await s.getFlowId());
        formData.append('switchJobId', await job.getId());
        formData.append('metadata', JSON.stringify(metadata));

        // Submit to API
        await job.log(LogLevel.Info, `${scriptName}: Submitting ${fileName} for approval`);

        const response = await axios.post(
            `${apiUrl}/api/approvals/create`,
            formData,
            {
                headers: formData.getHeaders(),
                timeout: 30000
            }
        );

        if (response.data.success) {
            // Store approval information in private data
            await job.setPrivateData("ApprovalId", response.data.approvalId);
            await job.setPrivateData("ApprovalToken", response.data.token);
            await job.setPrivateData("ApprovalStatus", "pending");
            await job.setPrivateData("ApprovalSubmitTime", new Date().toISOString());

            await job.log(LogLevel.Info, `${scriptName}: Approval created with ID ${response.data.approvalId}`);

            // Send notification if configured
            if (notificationEmail) {
                await sendNotification(s, job, notificationEmail, response.data.approvalId);
            }

            // Job continues in flow (waiting for approval)
            await job.sendToData(Connection.Level.Success);
        } else {
            throw new Error("API returned unsuccessful response");
        }

    } catch (error) {
        await job.log(LogLevel.Error, `${scriptName}: Error submitting approval - ${error.message}`);
        await job.sendToData(Connection.Level.Error);
    }
}

async function sendNotification(s, job, email, approvalId) {
    try {
        const message = `PDF approval submitted:\n` +
            `File: ${await job.getName()}\n` +
            `Job ID: ${await job.getUniqueId()}\n` +
            `Approval ID: ${approvalId}\n` +
            `Time: ${new Date().toLocaleString()}`;

        await s.sendEmail(email, "Approval Submitted", message);
    } catch (error) {
        await job.log(LogLevel.Warning, `Failed to send notification: ${error.message}`);
    }
}