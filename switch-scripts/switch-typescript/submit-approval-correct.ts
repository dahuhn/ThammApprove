// Enfocus Switch Script: Submit PDF for Approval
// Verwendet Switch Script API korrekt

async function jobArrived(s: Switch, job: Job): Promise<void> {
    const scriptName = "ThammApprove Submit";

    try {
        // Switch Script API: Properties über s.getPropertyValue()
        // ABER: In TypeScript ist es await flowElement.getPropertyStringValue()
        const flowElement = await s.getFlowElement();

        // Get properties
        const apiUrl = await flowElement.getPropertyStringValue("apiUrl");
        const apiUrlFinal = apiUrl || "http://172.16.0.66:3101";

        await job.log(LogLevel.Info, `${scriptName}: Using API URL: ${apiUrlFinal}`);

        // Get customer data from properties or private data
        let customerEmail = await flowElement.getPropertyStringValue("customerEmail");
        if (!customerEmail) {
            customerEmail = await job.getPrivateData("CustomerEmail");
        }
        if (!customerEmail) {
            customerEmail = "";
        }

        let customerName = await flowElement.getPropertyStringValue("customerName");
        if (!customerName) {
            customerName = await job.getPrivateData("CustomerName");
        }

        const notificationEmail = await flowElement.getPropertyStringValue("notificationEmail");

        // Validate required fields
        if (!customerEmail) {
            await job.log(LogLevel.Error, `${scriptName}: Customer email is required`);
            await job.sendToNull();
            return;
        }

        // Get job information
        const jobPathTemp = await job.get(AccessLevel.ReadWrite);
        const fileName = await job.getName();
        const jobId = `${fileName}_${Date.now()}`;

        // Store original filename
        await job.setPrivateData("OriginalFileName", fileName);

        // Log submission
        await job.log(LogLevel.Info, `${scriptName}: Submitting ${fileName} for approval`);

        // Node.js HTTP request mit form-data
        const http = require('http');
        const https = require('https');
        const fs = require('fs');
        const path = require('path');

        // Erstelle multipart/form-data manuell
        const boundary = '----FormBoundary' + Math.random().toString(16);
        const url = new URL(apiUrlFinal + '/api/approvals/create');

        // Read file
        const fileContent = fs.readFileSync(jobPathTemp);

        // Build multipart body
        let body = '';

        // Add file
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="pdf"; filename="${fileName}"\r\n`;
        body += `Content-Type: application/pdf\r\n\r\n`;

        // Convert file content to string (this is simplified)
        const bodyParts = [
            Buffer.from(body, 'utf8'),
            fileContent,
            Buffer.from('\r\n', 'utf8')
        ];

        // Add form fields
        const fields = {
            jobId: jobId,
            fileName: fileName,
            customerEmail: customerEmail,
            customerName: customerName || '',
            metadata: JSON.stringify({
                submitTime: new Date().toISOString(),
                originalPath: jobPathTemp
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

        // Make request
        const options = {
            method: 'POST',
            hostname: url.hostname,
            port: url.port || 3101,
            path: url.pathname,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': bodyBuffer.length
            }
        };

        await new Promise<void>((resolve, reject) => {
            const req = http.request(options, (res: any) => {
                let data = '';

                res.on('data', (chunk: any) => {
                    data += chunk;
                });

                res.on('end', async () => {
                    try {
                        if (res.statusCode !== 200) {
                            await job.log(LogLevel.Error, `${scriptName}: HTTP Error ${res.statusCode}`);
                            await job.sendToNull();
                            reject(new Error(`HTTP ${res.statusCode}`));
                            return;
                        }

                        const result = JSON.parse(data);

                        if (result.success) {
                            await job.setPrivateData("ApprovalId", result.approvalId);
                            await job.setPrivateData("ApprovalToken", result.token);
                            await job.setPrivateData("ApprovalStatus", "pending");
                            await job.setPrivateData("ApprovalSubmitTime", new Date().toISOString());

                            await job.log(LogLevel.Info, `${scriptName}: Approval created with ID ${result.approvalId}`);

                            // Send to success output
                            await job.sendToSingle(jobPathTemp);
                            resolve();
                        } else {
                            await job.log(LogLevel.Error, `${scriptName}: API returned error`);
                            await job.sendToNull();
                            reject(new Error('API error'));
                        }
                    } catch (e: any) {
                        await job.log(LogLevel.Error, `${scriptName}: ${e.message}`);
                        await job.sendToNull();
                        reject(e);
                    }
                });
            });

            req.on('error', async (error: any) => {
                await job.log(LogLevel.Error, `${scriptName}: Request failed - ${error.message}`);
                await job.sendToNull();
                reject(error);
            });

            req.write(bodyBuffer);
            req.end();
        });

    } catch (error: any) {
        await job.log(LogLevel.Error, `${scriptName}: Fatal error - ${error.message}`);
        await job.sendToNull();
    }
}