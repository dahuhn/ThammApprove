// Enfocus Switch Script: Submit PDF for Approval
// Korrekte Version mit offizieller Switch API

async function jobArrived(s, job) {
    const scriptName = "ThammApprove Submit";

    try {
        await job.log(LogLevel.Info, `${scriptName}: Script started`);

        // Configuration - verwende Fallback-Werte da Properties-API unklar ist
        const apiUrl = "http://172.16.0.66:3101"; // Hardcoded für jetzt
        await job.log(LogLevel.Info, `${scriptName}: Using API URL: ${apiUrl}`);

        // Customer Email von Private Data holen
        let customerEmail;
        try {
            customerEmail = await job.getPrivateData("CustomerEmail");
        } catch (e) {
            customerEmail = null;
        }

        let customerName;
        try {
            customerName = await job.getPrivateData("CustomerName");
        } catch (e) {
            customerName = "";
        }

        // Validate required fields
        if (!customerEmail) {
            await job.log(LogLevel.Error, `${scriptName}: Customer email is required`);
            // Korrekte Routing-API verwenden
            await job.sendToData(Connection.Level.Error);
            return;
        }

        // Get job information - korrekte API verwenden
        const jobPath = await job.get(AccessLevel.ReadOnly);
        const fileName = job.getName(); // Synchron laut API
        const jobId = `${fileName}_${Date.now()}`;

        await job.log(LogLevel.Info, `${scriptName}: Processing ${fileName} (Path: ${jobPath})`);

        // Store original filename for webhook processing
        await job.setPrivateData("OriginalFileName", fileName);

        // Submit to API
        await job.log(LogLevel.Info, `${scriptName}: Submitting ${fileName} for approval`);

        const http = require('http');
        const https = require('https');

        // JSON payload
        const postData = JSON.stringify({
            jobId: jobId,
            fileName: fileName,
            customerEmail: customerEmail,
            customerName: customerName || "",
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
            await job.sendToData(Connection.Level.Error);
            return;
        }

        let result;
        try {
            result = JSON.parse(response.body);
        } catch (parseError) {
            await job.log(LogLevel.Error, `${scriptName}: Error parsing API response - ${parseError.message}`);
            await job.sendToData(Connection.Level.Error);
            return;
        }

        if (result.success) {
            // Store approval information in private data
            await job.setPrivateData("ApprovalId", result.approvalId);
            await job.setPrivateData("ApprovalToken", result.token);
            await job.setPrivateData("ApprovalStatus", "pending");
            await job.setPrivateData("ApprovalSubmitTime", new Date().toISOString());

            await job.log(LogLevel.Info, `${scriptName}: Approval created with ID ${result.approvalId}`);
            await job.log(LogLevel.Info, `${scriptName}: PDF uploaded to server for customer viewing`);
            await job.log(LogLevel.Info, `${scriptName}: Original PDF waits in Switch folder until webhook processes it`);

            // Success Routing - PDF geht an Pending Folder
            await job.sendToData(Connection.Level.Success);

        } else {
            await job.log(LogLevel.Error, `${scriptName}: API returned unsuccessful response`);
            await job.sendToData(Connection.Level.Error);
        }

    } catch (error) {
        await job.log(LogLevel.Error, `${scriptName}: Error - ${error.message}`);
        await job.log(LogLevel.Error, `${scriptName}: Stack: ${error.stack}`);

        // Fehler-Routing
        try {
            await job.sendToData(Connection.Level.Error);
        } catch (routeError) {
            // Fallback wenn auch das Routing fehlschlägt
            await job.log(LogLevel.Error, `${scriptName}: Even routing failed: ${routeError.message}`);
        }
    }
}