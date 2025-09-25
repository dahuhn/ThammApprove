// Enfocus Switch Script: Submit PDF for Approval
// JavaScript-Version für Switch (ohne TypeScript)

async function jobArrived(s, job) {
    const scriptName = "ThammApprove Submit";

    try {
        // Get flow element for properties
        const flowElement = await s.getFlowElement();

        // Get configuration
        const apiUrl = await flowElement.getPropertyStringValue("apiUrl") || "http://172.16.0.66:3101";
        await job.log(1, scriptName + ": Using API URL: " + apiUrl);

        const customerEmail = await flowElement.getPropertyStringValue("customerEmail") ||
                            await job.getPrivateData("CustomerEmail") || "";
        const customerName = await flowElement.getPropertyStringValue("customerName") ||
                           await job.getPrivateData("CustomerName") || "";
        const notificationEmail = await flowElement.getPropertyStringValue("notificationEmail");

        // Validate
        if (!customerEmail) {
            await job.log(3, scriptName + ": Customer email is required");
            await job.sendToNull();
            return;
        }

        // Get job info
        const tempPath = await job.get(AccessLevel.ReadOnly);
        const fileName = await job.getName();
        const jobId = fileName + "_" + Date.now();

        // Store for webhook
        await job.setPrivateData("OriginalFileName", fileName);

        // HTTP Request
        await job.log(1, scriptName + ": Submitting " + fileName);

        const http = require('http');
        const fs = require('fs');

        // Create form data manually
        const boundary = '----Boundary' + Date.now();
        const url = new URL(apiUrl + '/api/approvals/create');

        // Read file
        const fileData = fs.readFileSync(tempPath);

        // Build multipart
        let body = [];

        // Add file
        body.push(Buffer.from('--' + boundary + '\r\n'));
        body.push(Buffer.from('Content-Disposition: form-data; name="pdf"; filename="' + fileName + '"\r\n'));
        body.push(Buffer.from('Content-Type: application/pdf\r\n\r\n'));
        body.push(fileData);
        body.push(Buffer.from('\r\n'));

        // Add fields
        const fields = {
            jobId: jobId,
            fileName: fileName,
            customerEmail: customerEmail,
            customerName: customerName,
            metadata: JSON.stringify({
                submitTime: new Date().toISOString(),
                originalPath: tempPath
            })
        };

        for (const key in fields) {
            body.push(Buffer.from('--' + boundary + '\r\n'));
            body.push(Buffer.from('Content-Disposition: form-data; name="' + key + '"\r\n\r\n'));
            body.push(Buffer.from(fields[key] + '\r\n'));
        }

        body.push(Buffer.from('--' + boundary + '--\r\n'));

        const bodyBuffer = Buffer.concat(body);

        // Make request
        await new Promise((resolve, reject) => {
            const options = {
                method: 'POST',
                hostname: url.hostname,
                port: url.port || 3101,
                path: url.pathname,
                headers: {
                    'Content-Type': 'multipart/form-data; boundary=' + boundary,
                    'Content-Length': bodyBuffer.length
                }
            };

            const req = http.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', async () => {
                    try {
                        if (res.statusCode !== 200) {
                            await job.log(3, scriptName + ": HTTP Error " + res.statusCode);
                            await job.sendToNull();
                            reject(new Error("HTTP " + res.statusCode));
                            return;
                        }

                        const result = JSON.parse(data);

                        if (result.success) {
                            await job.setPrivateData("ApprovalId", result.approvalId);
                            await job.setPrivateData("ApprovalToken", result.token);
                            await job.setPrivateData("ApprovalStatus", "pending");

                            await job.log(1, scriptName + ": Created approval " + result.approvalId);

                            // Send to output 1 (Success)
                            await job.sendToSingle(tempPath);
                            resolve();
                        } else {
                            await job.log(3, scriptName + ": API error");
                            await job.sendToNull();
                            reject(new Error("API error"));
                        }
                    } catch (e) {
                        await job.log(3, scriptName + ": " + e.message);
                        await job.sendToNull();
                        reject(e);
                    }
                });
            });

            req.on('error', async (error) => {
                await job.log(3, scriptName + ": Request failed - " + error.message);
                await job.sendToNull();
                reject(error);
            });

            req.write(bodyBuffer);
            req.end();
        });

    } catch (error) {
        await job.log(3, scriptName + ": Error - " + error.message);
        await job.sendToNull();
    }
}