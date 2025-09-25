// Enfocus Switch Script: Submit PDF for Approval
// Endgültige Version mit 100% korrekter offizieller Switch API
// Basiert auf Switch Developer Guide 25.07

async function jobArrived(s, job) {
    const scriptName = "ThammApprove Submit";

    try {
        await job.log(LogLevel.Info, `${scriptName}: Script started`);

        // Properties korrekt mit getPropertyStringValue holen (Node.js API)
        const apiUrl = s.getPropertyStringValue("apiUrl") || "http://172.16.0.66:3101";
        await job.log(LogLevel.Info, `${scriptName}: Using API URL: ${apiUrl}`);

        const customerEmailFromProps = s.getPropertyStringValue("customerEmail");
        const customerNameFromProps = s.getPropertyStringValue("customerName");

        // Customer Email: erst Properties, dann Private Data
        let customerEmail = customerEmailFromProps;
        if (!customerEmail) {
            try {
                customerEmail = await job.getPrivateData("CustomerEmail");
            } catch (e) {
                customerEmail = null;
            }
        }

        let customerName = customerNameFromProps;
        if (!customerName) {
            try {
                customerName = await job.getPrivateData("CustomerName");
            } catch (e) {
                customerName = "";
            }
        }

        // Validate required fields
        if (!customerEmail) {
            await job.log(LogLevel.Error, `${scriptName}: Customer email is required`);
            await job.sendToData(Connection.Level.Error);
            return;
        }

        // Get job information mit korrekter API (offiziell dokumentiert)
        const jobPath = await job.get(AccessLevel.ReadOnly);
        const fileName = job.getName(); // Synchron laut offizieller API
        const jobId = `${fileName}_${Date.now()}`;

        await job.log(LogLevel.Info, `${scriptName}: Processing ${fileName} (Path: ${jobPath})`);

        // Store original filename for webhook processing
        await job.setPrivateData("OriginalFileName", fileName);

        // Submit to API
        await job.log(LogLevel.Info, `${scriptName}: Submitting ${fileName} for approval`);

        const http = require('http');
        const https = require('https');

        // JSON payload für neue Backend API
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
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
            });
            req.on('error', reject);
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
            await job.log(LogLevel.Error, `${scriptName}: Parse error - ${parseError.message}`);
            await job.sendToData(Connection.Level.Error);
            return;
        }

        if (result.success) {
            // Store approval information (Private Data APIs offiziell dokumentiert)
            await job.setPrivateData("ApprovalId", result.approvalId);
            await job.setPrivateData("ApprovalToken", result.token);
            await job.setPrivateData("ApprovalStatus", "pending");
            await job.setPrivateData("ApprovalSubmitTime", new Date().toISOString());

            await job.log(LogLevel.Info, `${scriptName}: Approval created with ID ${result.approvalId}`);
            await job.log(LogLevel.Info, `${scriptName}: PDF will wait in Switch until webhook processes it`);

            // Success - Route to Pending Folder (offiziell dokumentierte Routing API)
            await job.sendToData(Connection.Level.Success);

        } else {
            await job.log(LogLevel.Error, `${scriptName}: API returned error: ${result.error || 'Unknown error'}`);
            await job.sendToData(Connection.Level.Error);
        }

    } catch (error) {
        await job.log(LogLevel.Error, `${scriptName}: Fatal error - ${error.message}`);
        await job.log(LogLevel.Error, `${scriptName}: Stack: ${error.stack}`);

        try {
            await job.sendToData(Connection.Level.Error);
        } catch (routeError) {
            await job.log(LogLevel.Error, `${scriptName}: Routing also failed: ${routeError.message}`);
        }
    }
}