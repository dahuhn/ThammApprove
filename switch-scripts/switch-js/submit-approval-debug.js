// Enfocus Switch Script: Submit PDF for Approval
// Debug-Version mit ausführlichen Logs für VSCode Debugging

async function jobArrived(s, job) {
    const scriptName = "ThammApprove Submit";

    try {
        await job.log(LogLevel.Info, `${scriptName}: Script started - debugging version`);

        // Debug: Prüfe verfügbare Methoden auf s-Objekt
        await job.log(LogLevel.Info, `${scriptName}: Switch object type: ${typeof s}`);
        await job.log(LogLevel.Info, `${scriptName}: Switch methods: ${Object.getOwnPropertyNames(s).join(', ')}`);

        // Debug: Prüfe verfügbare Methoden auf job-Objekt
        await job.log(LogLevel.Info, `${scriptName}: Job object type: ${typeof job}`);
        await job.log(LogLevel.Info, `${scriptName}: Job methods: ${Object.getOwnPropertyNames(job).join(', ')}`);

        // Configuration mit Debug-Ausgabe
        let apiUrl = "http://172.16.0.66:3101"; // Fallback
        let customerEmail = "";

        try {
            await job.log(LogLevel.Info, `${scriptName}: Trying s.getPropertyValue...`);
            const propValue = await s.getPropertyValue("apiUrl");
            await job.log(LogLevel.Info, `${scriptName}: s.getPropertyValue result: ${propValue}`);
            if (propValue) apiUrl = propValue;
        } catch (e) {
            await job.log(LogLevel.Warning, `${scriptName}: s.getPropertyValue failed: ${e.message}`);

            // Versuche synchrone Version
            try {
                await job.log(LogLevel.Info, `${scriptName}: Trying synchronous s.getPropertyValue...`);
                const propValue = s.getPropertyValue("apiUrl");
                await job.log(LogLevel.Info, `${scriptName}: Sync s.getPropertyValue result: ${propValue}`);
                if (propValue) apiUrl = propValue;
            } catch (e2) {
                await job.log(LogLevel.Warning, `${scriptName}: Sync s.getPropertyValue failed: ${e2.message}`);
            }
        }

        await job.log(LogLevel.Info, `${scriptName}: Using API URL: ${apiUrl}`);

        // Customer Email mit Debug
        try {
            await job.log(LogLevel.Info, `${scriptName}: Getting customer email from properties...`);
            customerEmail = await s.getPropertyValue("customerEmail");
            await job.log(LogLevel.Info, `${scriptName}: Customer email from properties: ${customerEmail}`);
        } catch (e) {
            await job.log(LogLevel.Warning, `${scriptName}: Property customer email failed: ${e.message}`);
        }

        if (!customerEmail) {
            try {
                await job.log(LogLevel.Info, `${scriptName}: Getting customer email from private data...`);
                customerEmail = await job.getPrivateData("CustomerEmail");
                await job.log(LogLevel.Info, `${scriptName}: Customer email from private data: ${customerEmail}`);
            } catch (e) {
                await job.log(LogLevel.Warning, `${scriptName}: Private data customer email failed: ${e.message}`);
            }
        }

        // Validate required fields
        if (!customerEmail) {
            await job.log(LogLevel.Error, `${scriptName}: Customer email is required`);
            await job.sendToNull();
            return;
        }

        // Get job information mit Debug
        let jobPath, fileName;

        try {
            await job.log(LogLevel.Info, `${scriptName}: Getting job path...`);
            jobPath = await job.get(AccessLevel.ReadOnly);
            await job.log(LogLevel.Info, `${scriptName}: Job path: ${jobPath}`);
        } catch (e) {
            await job.log(LogLevel.Warning, `${scriptName}: job.get failed: ${e.message}`);

            // Versuche alternative Methoden
            try {
                await job.log(LogLevel.Info, `${scriptName}: Trying job.getPath...`);
                jobPath = job.getPath();
                await job.log(LogLevel.Info, `${scriptName}: Job path from getPath: ${jobPath}`);
            } catch (e2) {
                await job.log(LogLevel.Error, `${scriptName}: All job path methods failed: ${e2.message}`);
                await job.sendToNull();
                return;
            }
        }

        try {
            await job.log(LogLevel.Info, `${scriptName}: Getting job name...`);
            fileName = await job.getName();
            await job.log(LogLevel.Info, `${scriptName}: File name: ${fileName}`);
        } catch (e) {
            await job.log(LogLevel.Warning, `${scriptName}: Async job.getName failed: ${e.message}`);

            try {
                fileName = job.getName();
                await job.log(LogLevel.Info, `${scriptName}: File name (sync): ${fileName}`);
            } catch (e2) {
                await job.log(LogLevel.Error, `${scriptName}: All getName methods failed: ${e2.message}`);
                fileName = "unknown.pdf";
            }
        }

        const jobId = `${fileName}_${Date.now()}`;
        await job.log(LogLevel.Info, `${scriptName}: Generated job ID: ${jobId}`);

        // Store original filename for webhook processing
        try {
            await job.log(LogLevel.Info, `${scriptName}: Setting private data...`);
            await job.setPrivateData("OriginalFileName", fileName);
            await job.log(LogLevel.Info, `${scriptName}: Private data set successfully`);
        } catch (e) {
            await job.log(LogLevel.Warning, `${scriptName}: Setting private data failed: ${e.message}`);
        }

        // Submit to API - vereinfacht für Debug
        await job.log(LogLevel.Info, `${scriptName}: Starting API submission...`);

        // Node.js HTTP - das sollte immer funktionieren
        const http = require('http');
        const https = require('https');

        const postData = JSON.stringify({
            jobId: jobId,
            fileName: fileName,
            customerEmail: customerEmail,
            debug: true,
            timestamp: new Date().toISOString()
        });

        await job.log(LogLevel.Info, `${scriptName}: POST data prepared: ${postData}`);

        const url = new URL(`${apiUrl}/api/approvals/debug`);
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

        await job.log(LogLevel.Info, `${scriptName}: HTTP options: ${JSON.stringify(options)}`);

        // HTTP Request
        const result = await new Promise((resolve, reject) => {
            const req = httpModule.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
            });

            req.on('error', (error) => reject(error));
            req.write(postData);
            req.end();
        });

        await job.log(LogLevel.Info, `${scriptName}: HTTP response: ${result.statusCode} - ${result.body}`);

        // Success routing mit Debug
        try {
            await job.log(LogLevel.Info, `${scriptName}: Attempting job routing...`);
            await job.sendToSingle(jobPath);
            await job.log(LogLevel.Info, `${scriptName}: Job routed successfully`);
        } catch (e) {
            await job.log(LogLevel.Warning, `${scriptName}: sendToSingle failed: ${e.message}`);

            // Fallback routing
            try {
                await job.log(LogLevel.Info, `${scriptName}: Trying fallback routing...`);
                await job.sendToData(1);
                await job.log(LogLevel.Info, `${scriptName}: Fallback routing successful`);
            } catch (e2) {
                await job.log(LogLevel.Error, `${scriptName}: All routing methods failed: ${e2.message}`);
            }
        }

    } catch (error) {
        await job.log(LogLevel.Error, `${scriptName}: Fatal error - ${error.message}`);
        await job.log(LogLevel.Error, `${scriptName}: Error stack: ${error.stack}`);

        try {
            await job.sendToNull();
        } catch (e) {
            await job.log(LogLevel.Error, `${scriptName}: Even sendToNull failed: ${e.message}`);
        }
    }
}