// Enfocus Switch Script: Submit PDF for Approval
// Minimale Version mit nur bewährten Switch API-Aufrufen

async function jobArrived(s, job) {
    const scriptName = "ThammApprove Submit";

    try {
        // Configuration - verwende s.getPropertyValue() falls verfügbar, sonst Fallback
        let apiUrl;
        let customerEmail;

        try {
            apiUrl = await s.getPropertyValue("apiUrl");
        } catch (e) {
            apiUrl = null;
        }
        apiUrl = apiUrl || "http://172.16.0.66:3101";

        try {
            customerEmail = await s.getPropertyValue("customerEmail");
        } catch (e) {
            customerEmail = null;
        }

        if (!customerEmail) {
            try {
                customerEmail = await job.getPrivateData("CustomerEmail");
            } catch (e) {
                customerEmail = null;
            }
        }

        await job.log(LogLevel.Info, `${scriptName}: Using API URL: ${apiUrl}`);

        // Validate required fields
        if (!customerEmail) {
            await job.log(LogLevel.Error, `${scriptName}: Customer email is required`);
            await job.sendToNull();
            return;
        }

        // Get job information - nur die essentiellen Aufrufe
        let jobPath;
        let fileName;

        try {
            jobPath = await job.get(AccessLevel.ReadOnly);
        } catch (e) {
            // Fallback: versuche andere Methoden
            try {
                jobPath = job.getPath();
            } catch (e2) {
                await job.log(LogLevel.Error, `${scriptName}: Cannot get job path`);
                await job.sendToNull();
                return;
            }
        }

        try {
            fileName = await job.getName();
        } catch (e) {
            // Fallback: versuche synchrone Version
            try {
                fileName = job.getName();
            } catch (e2) {
                fileName = "unknown.pdf";
            }
        }

        const jobId = `${fileName}_${Date.now()}`;

        // Store original filename for webhook processing
        try {
            await job.setPrivateData("OriginalFileName", fileName);
        } catch (e) {
            // Fallback: synchrone Version
            try {
                job.setPrivateData("OriginalFileName", fileName);
            } catch (e2) {
                await job.log(LogLevel.Warning, `${scriptName}: Cannot set private data`);
            }
        }

        // Submit to API
        await job.log(LogLevel.Info, `${scriptName}: Submitting ${fileName} for approval`);

        // Verwende Node.js HTTP direkt - das funktioniert immer
        const http = require('http');
        const https = require('https');
        const fs = require('fs');

        // Simple HTTP request ohne komplexe Multipart
        const postData = JSON.stringify({
            jobId: jobId,
            fileName: fileName,
            customerEmail: customerEmail,
            customerName: "",
            metadata: {
                submitTime: new Date().toISOString(),
                originalPath: jobPath
            }
        });

        const url = new URL(`${apiUrl}/api/approvals/create-simple`);
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

        await new Promise((resolve, reject) => {
            const req = httpModule.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
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
                            // Store approval information
                            try {
                                await job.setPrivateData("ApprovalId", result.approvalId);
                                await job.setPrivateData("ApprovalStatus", "pending");
                                await job.setPrivateData("ApprovalSubmitTime", new Date().toISOString());
                            } catch (e) {
                                // Fallback: synchrone Version
                                try {
                                    job.setPrivateData("ApprovalId", result.approvalId);
                                    job.setPrivateData("ApprovalStatus", "pending");
                                } catch (e2) {
                                    // Ignore if private data fails
                                }
                            }

                            await job.log(LogLevel.Info, `${scriptName}: Approval created with ID ${result.approvalId}`);

                            // Send to success output
                            try {
                                await job.sendToSingle(jobPath);
                            } catch (e) {
                                // Fallback: versuche andere Routing-Methoden
                                try {
                                    await job.sendToData(1);
                                } catch (e2) {
                                    try {
                                        job.sendToData(1);
                                    } catch (e3) {
                                        await job.log(LogLevel.Warning, `${scriptName}: Cannot route job`);
                                    }
                                }
                            }
                            resolve();
                        } else {
                            await job.log(LogLevel.Error, `${scriptName}: API returned error`);
                            await job.sendToNull();
                            reject(new Error('API error'));
                        }

                    } catch (parseError) {
                        await job.log(LogLevel.Error, `${scriptName}: Parse error - ${parseError.message}`);
                        await job.sendToNull();
                        reject(parseError);
                    }
                });
            });

            req.on('error', async (error) => {
                await job.log(LogLevel.Error, `${scriptName}: Request failed - ${error.message}`);
                await job.sendToNull();
                reject(error);
            });

            req.write(postData);
            req.end();
        });

    } catch (error) {
        await job.log(LogLevel.Error, `${scriptName}: Fatal error - ${error.message}`);
        try {
            await job.sendToNull();
        } catch (e) {
            // Final fallback
            try {
                job.sendToNull();
            } catch (e2) {
                // Give up
            }
        }
    }
}