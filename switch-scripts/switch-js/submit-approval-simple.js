// Enfocus Switch Script: Submit PDF for Approval
// Vereinfachte Version mit nur bewährten Switch API-Aufrufen

async function jobArrived(s, job) {
    const scriptName = "ThammApprove Submit";

    try {
        // Get configuration from Switch properties
        const apiUrl = await s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        await job.log(LogLevel.Info, `${scriptName}: Using API URL: ${apiUrl}`);

        const customerEmail = await s.getPropertyValue("customerEmail") ||
                            await job.getPrivateData("CustomerEmail") || "";
        const customerName = await s.getPropertyValue("customerName") ||
                           await job.getPrivateData("CustomerName") || "";

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
            switchJobId: jobId,
            metadata: JSON.stringify({
                submitTime: new Date().toISOString(),
                originalPath: jobPath
            })
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

                            await job.log(LogLevel.Info, `${scriptName}: Approval created with ID ${result.approvalId}`);
                            await job.log(LogLevel.Info, `${scriptName}: PDF uploaded to server for customer viewing`);

                            // Send to success output (Pending Folder)
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