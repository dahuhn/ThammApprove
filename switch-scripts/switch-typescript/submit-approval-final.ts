// Enfocus Switch Script: Submit PDF for Approval
// Korrekt angepasst für Switch TypeScript API

interface ApprovalMetadata {
    submitTime: string;
    originalPath: string;
    [key: string]: string;
}

async function jobArrived(s: Switch, job: Job): Promise<void> {
    const scriptName = "ThammApprove Submit";

    try {
        // Get configuration from Switch flow element properties using FlowElement
        const flowElement = await s.getFlowElement();
        const apiUrl = await flowElement.getPropertyStringValue("apiUrl") || "http://172.16.0.66:3101";
        await job.log(LogLevel.Info, `${scriptName}: Using API URL: ${apiUrl}`);

        const customerEmail = await flowElement.getPropertyStringValue("customerEmail") || await job.getPrivateData("CustomerEmail") || "";
        const customerName = await flowElement.getPropertyStringValue("customerName") || await job.getPrivateData("CustomerName");
        const notificationEmail = await flowElement.getPropertyStringValue("notificationEmail");

        // CONNECTION NAMES
        const successName = await flowElement.getPropertyStringValue("successName") || "Success";
        const errorName = await flowElement.getPropertyStringValue("errorName") || "Error";

        // Validate required fields
        if (!customerEmail) {
            await job.log(LogLevel.Error, `${scriptName}: Customer email is required`);
            await job.sendToNull();
            return;
        }

        // Get job information
        const jobPath = await job.get(AccessLevel.ReadOnly);
        const fileName = await job.getName();
        const jobId = `${fileName}_${Date.now()}`;

        // Store original filename for later webhook processing
        await job.setPrivateData("OriginalFileName", fileName);

        // Prepare metadata
        const metadata: ApprovalMetadata = {
            submitTime: new Date().toISOString(),
            originalPath: jobPath
        };

        // Submit to API using HTTP
        await job.log(LogLevel.Info, `${scriptName}: Submitting ${fileName} for approval`);

        // Use Node.js built-in modules for HTTP request
        const https = require('https');
        const fs = require('fs');
        const FormData = require('form-data');

        const url = `${apiUrl}/api/approvals/create`;

        // Create form data
        const form = new FormData();
        form.append('pdf', fs.createReadStream(jobPath), fileName);
        form.append('jobId', jobId);
        form.append('fileName', fileName);
        form.append('customerEmail', customerEmail);
        form.append('customerName', customerName || '');
        form.append('metadata', JSON.stringify(metadata));

        // Make HTTP request
        await new Promise<void>((resolve, reject) => {
            const parsedUrl = new URL(url);
            const options = {
                method: 'POST',
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 3101),
                path: parsedUrl.pathname,
                headers: form.getHeaders()
            };

            const req = (parsedUrl.protocol === 'https:' ? https : require('http')).request(options, (res: any) => {
                let data = '';

                res.on('data', (chunk: any) => {
                    data += chunk;
                });

                res.on('end', async () => {
                    if (res.statusCode !== 200) {
                        await job.log(LogLevel.Error, `${scriptName}: HTTP Error ${res.statusCode} - ${data}`);
                        await job.sendToNull();
                        reject(new Error(`HTTP Error ${res.statusCode}`));
                        return;
                    }

                    try {
                        const result = JSON.parse(data);

                        if (result.success) {
                            // Store approval information
                            await job.setPrivateData("ApprovalId", result.approvalId);
                            await job.setPrivateData("ApprovalToken", result.token);
                            await job.setPrivateData("ApprovalStatus", "pending");
                            await job.setPrivateData("ApprovalSubmitTime", new Date().toISOString());

                            await job.log(LogLevel.Info, `${scriptName}: Approval created with ID ${result.approvalId}`);
                            await job.log(LogLevel.Info, `${scriptName}: PDF uploaded to server for customer viewing`);

                            // Send notification if configured
                            if (notificationEmail) {
                                await sendNotification(s, job, notificationEmail, result.approvalId);
                            }

                            // Route to Success
                            await job.sendToSingle(jobPath);
                            resolve();
                        } else {
                            await job.log(LogLevel.Error, `${scriptName}: API returned unsuccessful response`);
                            await job.sendToNull();
                            reject(new Error('API returned unsuccessful'));
                        }
                    } catch (parseError: any) {
                        await job.log(LogLevel.Error, `${scriptName}: Error parsing response - ${parseError.message}`);
                        await job.sendToNull();
                        reject(parseError);
                    }
                });
            });

            req.on('error', async (error: any) => {
                await job.log(LogLevel.Error, `${scriptName}: Request error - ${error.message}`);
                await job.sendToNull();
                reject(error);
            });

            form.pipe(req);
        });

    } catch (error: any) {
        await job.log(LogLevel.Error, `${scriptName}: Error - ${error.message}`);
        await job.sendToNull();
    }
}

async function sendNotification(s: Switch, job: Job, email: string, approvalId: string): Promise<void> {
    try {
        const fileName = await job.getName();

        // Log notification instead of sending email (Switch email API may differ)
        await job.log(LogLevel.Info, `Notification would be sent to ${email} for approval ${approvalId}`);

        // If Switch has email support, it would be through a different API
        // await s.sendMailMessage(...) or similar

    } catch (error: any) {
        await job.log(LogLevel.Warning, `Failed to send notification: ${error.message}`);
    }
}