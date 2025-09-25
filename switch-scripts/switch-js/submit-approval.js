// Enfocus Switch Script: Submit PDF for Approval
// Modern JavaScript (no TypeScript) for Switch 2022+

async function jobArrived(s, job) {
    const scriptName = "ThammApprove Submit";

    try {
        // Get configuration from Switch properties (direkt von s)
        const apiUrl = await s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        await job.log(LogLevel.Info, `${scriptName}: Using API URL: ${apiUrl}`);

        const customerEmail = await s.getPropertyValue("customerEmail") ||
                            await job.getPrivateData("CustomerEmail") || "";
        const customerName = await s.getPropertyValue("customerName") ||
                           await job.getPrivateData("CustomerName") || "";
        const notificationEmail = await s.getPropertyValue("notificationEmail");

        // CONNECTION NAMES
        const successName = await s.getPropertyValue("successName") || "Success";
        const errorName = await s.getPropertyValue("errorName") || "Error";

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

        // Store original filename for webhook processing
        await job.setPrivateData("OriginalFileName", fileName);

        // Prepare metadata
        const metadata = {
            submitTime: new Date().toISOString(),
            originalPath: jobPath,
            jobNumber: await job.getJobNumber() || "",
            priority: await job.getPriority() || "Normal"
        };

        // Add private data as metadata
        const privateDataKeys = await job.getPrivateDataKeys();
        for (const key of privateDataKeys) {
            const value = await job.getPrivateData(key);
            if (value) {
                metadata[`privateData_${key}`] = value;
            }
        }

        // Submit to API
        await job.log(LogLevel.Info, `${scriptName}: Submitting ${fileName} for approval`);

        const http = require('http');
        const https = require('https');
        const fs = require('fs');

        // Create form data
        const boundary = `----FormBoundary${Date.now()}`;
        const url = new URL(`${apiUrl}/api/approvals/create`);

        // Read file
        const fileData = fs.readFileSync(jobPath);

        // Build multipart form data
        const formParts = [];

        // Add PDF file
        formParts.push(`--${boundary}\r\n`);
        formParts.push(`Content-Disposition: form-data; name="pdf"; filename="${fileName}"\r\n`);
        formParts.push(`Content-Type: application/pdf\r\n\r\n`);

        const textPart = formParts.join('');
        const bodyParts = [
            Buffer.from(textPart, 'utf8'),
            fileData,
            Buffer.from('\r\n', 'utf8')
        ];

        // Add form fields
        const fields = {
            jobId: jobId,
            fileName: fileName,
            customerEmail: customerEmail,
            customerName: customerName,
            switchFlowId: "",
            switchJobId: jobId,
            metadata: JSON.stringify(metadata)
        };

        for (const [key, value] of Object.entries(fields)) {
            const fieldData = `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
                `${value}\r\n`;
            bodyParts.push(Buffer.from(fieldData, 'utf8'));
        }

        bodyParts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
        const bodyBuffer = Buffer.concat(bodyParts);

        // Make HTTP request
        const httpModule = url.protocol === 'https:' ? https : http;
        const options = {
            method: 'POST',
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 3101),
            path: url.pathname,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': bodyBuffer.length
            }
        };

        await new Promise((resolve, reject) => {
            const req = httpModule.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', async () => {
                    try {
                        if (res.statusCode !== 200) {
                            await job.log(LogLevel.Error, `${scriptName}: HTTP Error ${res.statusCode} - ${data}`);
                            await job.sendToNull();
                            reject(new Error(`HTTP ${res.statusCode}`));
                            return;
                        }

                        const result = JSON.parse(data);

                        if (result.success) {
                            // Store approval information in private data
                            await job.setPrivateData("ApprovalId", result.approvalId);
                            await job.setPrivateData("ApprovalToken", result.token);
                            await job.setPrivateData("ApprovalStatus", "pending");
                            await job.setPrivateData("ApprovalSubmitTime", new Date().toISOString());
                            await job.setPrivateData("ServerUploadPath", `/uploads/${result.approvalId}.pdf`);

                            await job.log(LogLevel.Info, `${scriptName}: Approval created with ID ${result.approvalId}`);
                            await job.log(LogLevel.Info, `${scriptName}: PDF uploaded to server for customer viewing`);
                            await job.log(LogLevel.Info, `${scriptName}: Original PDF waits in Switch folder until webhook processes it`);

                            // Send notification if configured
                            if (notificationEmail) {
                                await sendNotification(s, job, notificationEmail, result.approvalId);
                            }

                            // IMPORTANT: PDF is now stored in TWO places:
                            // 1. ThammApprove Server (customer can view/approve in browser)
                            // 2. Switch Pending Folder (original PDF waits for webhook)
                            // Route to Success → Pending Folder
                            await job.sendToSingle(jobPath);
                            resolve();
                        } else {
                            await job.log(LogLevel.Error, `${scriptName}: API returned unsuccessful response`);
                            await job.sendToNull();
                            reject(new Error('API unsuccessful'));
                        }

                    } catch (parseError) {
                        await job.log(LogLevel.Error, `${scriptName}: Error parsing API response - ${parseError.message}`);
                        await job.sendToNull();
                        reject(parseError);
                    }
                });
            });

            req.on('error', async (error) => {
                await job.log(LogLevel.Error, `${scriptName}: HTTP request failed - ${error.message}`);
                await job.sendToNull();
                reject(error);
            });

            req.write(bodyBuffer);
            req.end();
        });

    } catch (error) {
        await job.log(LogLevel.Error, `${scriptName}: Error submitting approval - ${error.message}`);
        await job.sendToNull();
    }
}

async function sendNotification(s, job, email, approvalId) {
    try {
        const fileName = await job.getName();
        const message = `PDF approval submitted:
File: ${fileName}
Approval ID: ${approvalId}
Time: ${new Date().toLocaleString()}

Note: PDF uploaded to server for customer review.
Original PDF remains in Switch workflow for processing.`;

        // Log notification (Switch email API may differ)
        await job.log(LogLevel.Info, `Notification for ${email}: ${message.replace(/\n/g, ' ')}`);

        // If Switch has email capability:
        // await s.sendEmailMessage(email, "Approval Submitted", message);

    } catch (error) {
        await job.log(LogLevel.Warning, `Failed to send notification: ${error.message}`);
    }
}