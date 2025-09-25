// Enfocus Switch Script: Submit PDF for Approval (TypeScript)
// This script sends PDF files to the ThammApprove system
// Uses modern TypeScript features for Switch 2022 Fall+
// PDF wird an Server gesendet (für Kunde) UND in Switch behalten (für Workflow)

interface ApprovalMetadata {
    submitTime: string;
    switchServer: string;
    flowName: string;
    elementName: string;
    originalPath: string;
    jobNumber: string;
    priority: string;
    [key: string]: string;
}

function jobArrived(s: Switch, job: Job): void {
    const scriptName = "ThammApprove Submit";

    try {
        // Get configuration from Switch flow element properties
        const apiUrl = s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        job.log(LogLevel.Info, `${scriptName}: Using API URL: ${apiUrl}`);

        const customerEmail = s.getPropertyValue("customerEmail") || job.getPrivateData("CustomerEmail") || "";
        const customerName = s.getPropertyValue("customerName") || job.getPrivateData("CustomerName");
        const notificationEmail = s.getPropertyValue("notificationEmail");

        // CONNECTION NAMES - können in Properties definiert werden
        const successName = s.getPropertyValue("successName") || "Success";
        const errorName = s.getPropertyValue("errorName") || "Error";

        // Validate required fields
        if (!customerEmail) {
            job.log(LogLevel.Error, `${scriptName}: Customer email is required`);
            routeByName(s, job, errorName, scriptName);
            return;
        }

        // Get job information
        const jobPath = job.getPath();
        const fileName = job.getName();
        const jobId = `${job.getName()}_${Date.now()}`;

        // Store original filename for later webhook processing
        job.setPrivateData("OriginalFileName", fileName);

        // Prepare metadata
        const metadata: ApprovalMetadata = {
            submitTime: new Date().toISOString(),
            switchServer: s.getServerName(),
            flowName: s.getFlowName(),
            elementName: s.getElementName(),
            originalPath: jobPath,
            jobNumber: job.getJobNumber() || "",
            priority: job.getPriority() || "Normal"
        };

        // Add all private data as metadata
        const privateDataKeys = job.getPrivateDataKeys();
        for (const key of privateDataKeys) {
            metadata[`privateData_${key}`] = job.getPrivateData(key);
        }

        // Submit to API using HTTP multipart
        job.log(LogLevel.Info, `${scriptName}: Submitting ${fileName} for approval`);

        const http = new HTTP();
        const url = `${apiUrl}/api/approvals/create`;

        // Create multipart form data
        const formData = new FormData();
        formData.addFile("pdf", jobPath);
        formData.addField("jobId", jobId);
        formData.addField("fileName", fileName);  // WICHTIG: Original-Dateiname für Webhook
        formData.addField("customerEmail", customerEmail);
        formData.addField("customerName", customerName || "");
        formData.addField("switchFlowId", s.getFlowId() || "");
        formData.addField("switchJobId", jobId || "");
        formData.addField("metadata", JSON.stringify(metadata));

        http.post(url, formData, (response: HTTPResponse) => {
            try {
                if (response.statusCode !== 200) {
                    job.log(LogLevel.Error, `${scriptName}: HTTP Error ${response.statusCode} - ${response.body}`);
                    routeByName(s, job, errorName, scriptName);
                    return;
                }

                const result = JSON.parse(response.body);

                if (result.success) {
                    // Store approval information in private data
                    job.setPrivateData("ApprovalId", result.approvalId);
                    job.setPrivateData("ApprovalToken", result.token);
                    job.setPrivateData("ApprovalStatus", "pending");
                    job.setPrivateData("ApprovalSubmitTime", new Date().toISOString());
                    job.setPrivateData("ServerUploadPath", `/uploads/${result.approvalId}.pdf`);

                    job.log(LogLevel.Info, `${scriptName}: Approval created with ID ${result.approvalId}`);
                    job.log(LogLevel.Info, `${scriptName}: PDF uploaded to server for customer viewing`);
                    job.log(LogLevel.Info, `${scriptName}: Original PDF waits in Switch folder until webhook processes it`);

                    // Send notification if configured
                    if (notificationEmail) {
                        sendNotification(s, job, notificationEmail, result.approvalId);
                    }

                    // IMPORTANT: PDF is now stored in TWO places:
                    // 1. ThammApprove Server (customer can view/approve in browser)
                    // 2. Switch Pending Folder (original PDF waits for webhook)
                    // Route to Success by NAME → Pending Folder
                    routeByName(s, job, successName, scriptName);
                } else {
                    job.log(LogLevel.Error, `${scriptName}: API returned unsuccessful response`);
                    routeByName(s, job, errorName, scriptName);
                }

            } catch (parseError: any) {
                job.log(LogLevel.Error, `${scriptName}: Error parsing API response - ${parseError.message}`);
                routeByName(s, job, errorName, scriptName);
            }
        });

    } catch (error: any) {
        job.log(LogLevel.Error, `${scriptName}: Error submitting approval - ${error.message}`);
        routeByName(s, job, "Error", scriptName);
    }
}

// Helper function to route by connection name (TypeScript)
function routeByName(s: Switch, job: Job, targetName: string, scriptName: string): void {
    // Get number of outgoing connections
    const numConnections = s.getOutgoingConnectionCount?.() || 10;

    job.log(LogLevel.Debug, `${scriptName}: Looking for connection named '${targetName}'`);

    // Check each connection by number and get its name
    for (let i = 1; i <= numConnections; i++) {
        try {
            const connectionName = s.getOutgoingName?.(i);

            if (connectionName) {
                job.log(LogLevel.Debug, `${scriptName}: Connection ${i} is named '${connectionName}'`);

                // Check if this is our target (case-insensitive, trimmed)
                if (connectionName.trim().toLowerCase() === targetName.trim().toLowerCase()) {
                    job.log(LogLevel.Info, `${scriptName}: Routing to '${targetName}' via Connection ${i}`);
                    job.sendToData(i);
                    return;
                }
            }
        } catch (e) {
            // Connection doesn't exist, continue
        }
    }

    // Check special connections
    if (targetName.toLowerCase() === "success") {
        job.log(LogLevel.Info, `${scriptName}: Routing to Success connection`);
        job.sendToData(Connection.Level.Success);
        return;
    }

    if (targetName.toLowerCase() === "error") {
        job.log(LogLevel.Info, `${scriptName}: Routing to Error connection`);
        job.sendToData(Connection.Level.Error);
        return;
    }

    // Fallback: Try to parse as number
    const connectionNum = parseInt(targetName, 10);
    if (!isNaN(connectionNum)) {
        job.log(LogLevel.Warning, `${scriptName}: No connection named '${targetName}' found, using number ${connectionNum}`);
        job.sendToData(connectionNum);
        return;
    }

    // Ultimate fallback
    job.log(LogLevel.Error, `${scriptName}: Could not find connection named '${targetName}', using Success`);
    job.sendToData(Connection.Level.Success);
}

function sendNotification(s: Switch, job: Job, email: string, approvalId: string): void {
    try {
        const message = `PDF approval submitted:
File: ${job.getName()}
Job ID: ${job.getName()}
Approval ID: ${approvalId}
Time: ${new Date().toLocaleString()}

Note: PDF uploaded to server for customer review.
Original PDF remains in Switch workflow for processing.`;

        s.sendEmail(email, "Approval Submitted", message);
    } catch (error: any) {
        job.log(LogLevel.Warning, `Failed to send notification: ${error.message}`);
    }
}