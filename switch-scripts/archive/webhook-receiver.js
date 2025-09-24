// Enfocus Switch Script: Webhook Receiver
// This script processes webhook callbacks from the approval system
// Use with Switch HTTP Server element

async function webhookReceived(s, request) {
    const scriptName = "ThammApprove Webhook";

    try {
        // Parse the webhook payload
        const payload = JSON.parse(request.body);

        await s.log(LogLevel.Info, `${scriptName}: Received webhook for job ${payload.jobId}`);

        // Find the corresponding job in Switch
        const job = await s.findJobByPrivateData("ApprovalId", payload.jobId);

        if (!job) {
            await s.log(LogLevel.Warning, `${scriptName}: No job found for approval ID ${payload.jobId}`);
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Job not found" })
            };
        }

        // Update job with approval results
        await job.setPrivateData("ApprovalStatus", payload.status);
        await job.setPrivateData("WebhookReceived", new Date().toISOString());

        if (payload.status === 'approved') {
            await job.setPrivateData("ApprovedBy", payload.approvedBy || "");
            await job.setPrivateData("ApprovedAt", payload.approvedAt || "");
            await job.setPrivateData("ApprovalComments", payload.comments || "");

            await job.log(LogLevel.Info, `${scriptName}: Job approved by ${payload.approvedBy}`);

            // Move job to approved folder
            await job.moveTo(s.getApprovedFolder());

        } else if (payload.status === 'rejected') {
            await job.setPrivateData("RejectedReason", payload.rejectedReason || "");
            await job.setPrivateData("RejectionComments", payload.comments || "");

            await job.log(LogLevel.Warning, `${scriptName}: Job rejected - ${payload.rejectedReason}`);

            // Move job to rejected folder
            await job.moveTo(s.getRejectedFolder());
        }

        // Send success response
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: "Webhook processed successfully"
            })
        };

    } catch (error) {
        await s.log(LogLevel.Error, `${scriptName}: Error processing webhook - ${error.message}`);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Internal server error",
                message: error.message
            })
        };
    }
}

// Alternative implementation for Switch WebServices module
async function processWebhook(s, xmlRequest) {
    const scriptName = "ThammApprove Webhook";

    try {
        // Extract JSON from XML wrapper (if using SOAP)
        const parser = require('xml2js').parseString;
        let payload;

        await new Promise((resolve, reject) => {
            parser(xmlRequest, (err, result) => {
                if (err) reject(err);
                else {
                    // Extract JSON payload from XML
                    payload = JSON.parse(result.envelope.body.webhookData);
                    resolve();
                }
            });
        });

        await s.log(LogLevel.Info, `${scriptName}: Processing webhook for job ${payload.jobId}`);

        // Create response XML
        const responseXml = `<?xml version="1.0" encoding="UTF-8"?>
            <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                <soap:Body>
                    <WebhookResponse>
                        <success>true</success>
                        <message>Processed</message>
                    </WebhookResponse>
                </soap:Body>
            </soap:Envelope>`;

        return responseXml;

    } catch (error) {
        await s.log(LogLevel.Error, `${scriptName}: Webhook error - ${error.message}`);

        const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
            <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                <soap:Body>
                    <soap:Fault>
                        <faultcode>Server</faultcode>
                        <faultstring>${error.message}</faultstring>
                    </soap:Fault>
                </soap:Body>
            </soap:Envelope>`;

        return errorXml;
    }
}