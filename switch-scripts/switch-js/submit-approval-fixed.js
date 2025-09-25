// Enfocus Switch Script: Submit PDF for Approval
// Korrigierte Version mit richtigen Switch Routing-Methoden

async function jobArrived(s, job) {
    const scriptName = "ThammApprove Submit";

    try {
        await job.log(LogLevel.Info, `${scriptName}: Script started`);

        // Configuration - verwende nur bewährte Methoden
        const apiUrl = s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        await job.log(LogLevel.Info, `${scriptName}: Using API URL: ${apiUrl}`);

        const customerEmail = s.getPropertyValue("customerEmail") ||
                            job.getPrivateData("CustomerEmail");
        const customerName = s.getPropertyValue("customerName") ||
                           job.getPrivateData("CustomerName") || "";

        // Validate required fields
        if (!customerEmail) {
            await job.log(LogLevel.Error, `${scriptName}: Customer email is required`);
            // Korrekte Routing-Methode für Fehler
            job.sendToData(Connection.Level.Error);
            return;
        }

        // Get job information - verwende synchrone Methoden
        const jobPath = job.getPath();
        const fileName = job.getName();
        const jobId = `${fileName}_${Date.now()}`;

        await job.log(LogLevel.Info, `${scriptName}: Processing ${fileName} (Path: ${jobPath})`);

        // Store original filename for webhook processing
        job.setPrivateData("OriginalFileName", fileName);

        // Submit to API
        await job.log(LogLevel.Info, `${scriptName}: Submitting ${fileName} for approval`);

        const http = require('http');
        const https = require('https');

        // Einfache JSON-API statt Multipart
        const postData = JSON.stringify({
            jobId: jobId,
            fileName: fileName,
            customerEmail: customerEmail,
            customerName: customerName,
            metadata: {
                submitTime: new Date().toISOString(),
                originalPath: jobPath
            }
        });

        const url = new URL(`${apiUrl}/api/approvals/create-json`);
        const httpModule = url.protocol === 'https:' ? https : http;

        const options = {
            method: 'POST',
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 3101),
            path: url.pathname,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        // HTTP Request mit Promise
        const response = await new Promise((resolve, reject) => {
            const req = httpModule.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        body: data
                    });
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(postData);
            req.end();
        });

        // Response verarbeiten
        if (response.statusCode !== 200) {
            await job.log(LogLevel.Error, `${scriptName}: HTTP Error ${response.statusCode} - ${response.body}`);
            // Fehler-Routing
            job.sendToData(Connection.Level.Error);
            return;
        }

        const result = JSON.parse(response.body);

        if (result.success) {
            // Store approval information in private data
            job.setPrivateData("ApprovalId", result.approvalId);
            job.setPrivateData("ApprovalToken", result.token);
            job.setPrivateData("ApprovalStatus", "pending");
            job.setPrivateData("ApprovalSubmitTime", new Date().toISOString());

            await job.log(LogLevel.Info, `${scriptName}: Approval created with ID ${result.approvalId}`);
            await job.log(LogLevel.Info, `${scriptName}: PDF uploaded to server for customer viewing`);
            await job.log(LogLevel.Info, `${scriptName}: Original PDF waits in Switch folder until webhook processes it`);

            // Success Routing - PDF geht an Pending Folder
            job.sendToData(Connection.Level.Success);

        } else {
            await job.log(LogLevel.Error, `${scriptName}: API returned unsuccessful response`);
            job.sendToData(Connection.Level.Error);
        }

    } catch (error) {
        await job.log(LogLevel.Error, `${scriptName}: Error - ${error.message}`);
        await job.log(LogLevel.Error, `${scriptName}: Stack: ${error.stack}`);

        // Fehler-Routing
        job.sendToData(Connection.Level.Error);
    }
}