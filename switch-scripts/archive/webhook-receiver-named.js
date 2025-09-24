// Enfocus Switch Script: Webhook Receiver (Named Connections Version)
// This script processes webhook callbacks from the approval system
// Use with Switch HTTP Server element
// Diese Version nutzt Connection-NAMEN statt Nummern!

async function webhookReceived(s, request) {
    const scriptName = "ThammApprove Webhook (Named)";

    try {
        // CONNECTION NAMES - Sie können diese in den Properties definieren
        // oder die Connections in Switch entsprechend benennen!
        const approvedFolderName = await s.getPropertyValue("approvedFolderName") || "Approved";
        const rejectedFolderName = await s.getPropertyValue("rejectedFolderName") || "Rejected";

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

            // Move job to approved folder using named connection
            await moveToNamedFolder(s, job, approvedFolderName, scriptName);

        } else if (payload.status === 'rejected') {
            await job.setPrivateData("RejectedReason", payload.rejectedReason || "");
            await job.setPrivateData("RejectionComments", payload.comments || "");

            await job.log(LogLevel.Warning, `${scriptName}: Job rejected - ${payload.rejectedReason}`);

            // Move job to rejected folder using named connection
            await moveToNamedFolder(s, job, rejectedFolderName, scriptName);
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

// Helper function to move job to named folder/connection
async function moveToNamedFolder(s, job, folderName, scriptName) {
    await job.log(LogLevel.Debug, `${scriptName}: Moving job to folder '${folderName}'`);

    // Try to find a folder with the given name
    try {
        // First check if it's a special folder name
        if (folderName.toLowerCase() === "approved") {
            const approvedFolder = await s.getApprovedFolder();
            if (approvedFolder) {
                await job.moveTo(approvedFolder);
                await job.log(LogLevel.Info, `${scriptName}: Moved to approved folder`);
                return;
            }
        }

        if (folderName.toLowerCase() === "rejected") {
            const rejectedFolder = await s.getRejectedFolder();
            if (rejectedFolder) {
                await job.moveTo(rejectedFolder);
                await job.log(LogLevel.Info, `${scriptName}: Moved to rejected folder`);
                return;
            }
        }

        // Otherwise, try routing by connection name
        await routeByName(s, job, folderName, scriptName);

    } catch (error) {
        await job.log(LogLevel.Error, `${scriptName}: Error moving to folder '${folderName}' - ${error.message}`);
        // Fallback: route to success
        await job.sendToData(Connection.Level.Success);
    }
}

// Helper function to route by connection name (async version)
async function routeByName(s, job, targetName, scriptName) {
    // Get number of outgoing connections
    const numConnections = await s.getOutgoingConnectionCount() || 10; // Fallback to 10

    await job.log(LogLevel.Debug, `${scriptName}: Looking for connection named '${targetName}'`);

    // Check each connection by number and get its name
    for (let i = 1; i <= numConnections; i++) {
        try {
            const connectionName = await s.getOutgoingName(i);

            if (connectionName) {
                await job.log(LogLevel.Debug, `${scriptName}: Connection ${i} is named '${connectionName}'`);

                // Check if this is our target (case-insensitive, trimmed)
                if (connectionName.trim().toLowerCase() === targetName.trim().toLowerCase()) {
                    await job.log(LogLevel.Info, `${scriptName}: Routing to '${targetName}' via Connection ${i}`);
                    await job.sendToData(i);
                    return;
                }
            }
        } catch (e) {
            // Connection doesn't exist, continue
        }
    }

    // Check special connections
    if (targetName.toLowerCase() === "success") {
        await job.log(LogLevel.Info, `${scriptName}: Routing to Success connection`);
        await job.sendToData(Connection.Level.Success);
        return;
    }

    if (targetName.toLowerCase() === "error") {
        await job.log(LogLevel.Info, `${scriptName}: Routing to Error connection`);
        await job.sendToData(Connection.Level.Error);
        return;
    }

    // Fallback: Try to parse as number
    const connectionNum = parseInt(targetName);
    if (!isNaN(connectionNum)) {
        await job.log(LogLevel.Warning, `${scriptName}: No connection named '${targetName}' found, using number ${connectionNum}`);
        await job.sendToData(connectionNum);
        return;
    }

    // Ultimate fallback
    await job.log(LogLevel.Error, `${scriptName}: Could not find connection named '${targetName}', using Success`);
    await job.sendToData(Connection.Level.Success);
}

// Alternative implementation for Switch WebServices module with named connections
async function processWebhook(s, xmlRequest) {
    const scriptName = "ThammApprove Webhook SOAP (Named)";

    try {
        // CONNECTION NAMES
        const approvedFolderName = await s.getPropertyValue("approvedFolderName") || "Approved";
        const rejectedFolderName = await s.getPropertyValue("rejectedFolderName") || "Rejected";

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

        // Find and update job
        const job = await s.findJobByPrivateData("ApprovalId", payload.jobId);

        if (job) {
            await job.setPrivateData("ApprovalStatus", payload.status);
            await job.setPrivateData("WebhookReceived", new Date().toISOString());

            if (payload.status === 'approved') {
                await job.setPrivateData("ApprovedBy", payload.approvedBy || "");
                await job.setPrivateData("ApprovedAt", payload.approvedAt || "");
                await job.setPrivateData("ApprovalComments", payload.comments || "");
                await moveToNamedFolder(s, job, approvedFolderName, scriptName);
            } else if (payload.status === 'rejected') {
                await job.setPrivateData("RejectedReason", payload.rejectedReason || "");
                await job.setPrivateData("RejectionComments", payload.comments || "");
                await moveToNamedFolder(s, job, rejectedFolderName, scriptName);
            }
        }

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