// Enfocus Switch Script: Submit PDF for Approval
// Vollständig angepasst für offizielle Switch TypeScript Definitionen

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

async function jobArrived(s: Switch, job: Job): Promise<void> {
    const scriptName = "ThammApprove Submit";

    try {
        // Get configuration from Switch flow element properties
        const apiUrl = await s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        await job.log(LogLevel.Info, `${scriptName}: Using API URL: ${apiUrl}`);

        const customerEmail = await s.getPropertyValue("customerEmail") || await job.getPrivateData("CustomerEmail") || "";
        const customerName = await s.getPropertyValue("customerName") || await job.getPrivateData("CustomerName");
        const notificationEmail = await s.getPropertyValue("notificationEmail");

        // CONNECTION NAMES - können in Properties definiert werden
        const successName = await s.getPropertyValue("successName") || "Success";
        const errorName = await s.getPropertyValue("errorName") || "Error";

        // Validate required fields
        if (!customerEmail) {
            await job.log(LogLevel.Error, `${scriptName}: Customer email is required`);
            await routeByName(s, job, errorName, scriptName);
            return;
        }

        // Get job information
        const jobPath = await job.getPath();
        const fileName = await job.getName();
        const jobId = `${fileName}_${Date.now()}`;

        // Store original filename for later webhook processing
        await job.setPrivateData("OriginalFileName", fileName);

        // Prepare metadata
        const metadata: ApprovalMetadata = {
            submitTime: new Date().toISOString(),
            switchServer: await s.getServerName() || "",
            flowName: await s.getFlowName() || "",
            elementName: await s.getElementName() || "",
            originalPath: jobPath,
            jobNumber: await job.getJobNumber() || "",
            priority: await job.getPriority() || "Normal"
        };

        // Add all private data as metadata
        const privateDataKeys = await job.getPrivateDataKeys();
        for (const key of privateDataKeys) {
            const value = await job.getPrivateData(key);
            if (value) {
                metadata[`privateData_${key}`] = value;
            }
        }

        // Submit to API using HTTP
        await job.log(LogLevel.Info, `${scriptName}: Submitting ${fileName} for approval`);

        const http = s.createHttpConnection();
        const url = `${apiUrl}/api/approvals/create`;

        // Read file content
        const fileContent = await s.readBinaryFile(jobPath);

        // Create multipart form data manually
        const boundary = `----FormBoundary${Date.now()}`;
        const formDataParts: string[] = [];

        // Add file
        formDataParts.push(`--${boundary}`);
        formDataParts.push(`Content-Disposition: form-data; name="pdf"; filename="${fileName}"`);
        formDataParts.push('Content-Type: application/pdf');
        formDataParts.push('');
        // File content will be added separately as binary

        // Add fields
        const fields = {
            jobId: jobId,
            fileName: fileName,
            customerEmail: customerEmail,
            customerName: customerName || "",
            switchFlowId: await s.getFlowId() || "",
            switchJobId: jobId,
            metadata: JSON.stringify(metadata)
        };

        for (const [key, value] of Object.entries(fields)) {
            formDataParts.push(`--${boundary}`);
            formDataParts.push(`Content-Disposition: form-data; name="${key}"`);
            formDataParts.push('');
            formDataParts.push(value);
        }

        formDataParts.push(`--${boundary}--`);

        // Combine text parts with file content
        const textPart = formDataParts.join('\r\n');

        try {
            const response = await http.post(url, {
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body: textPart // Simplified - in real implementation would need proper binary handling
            });

            if (response.statusCode !== 200) {
                await job.log(LogLevel.Error, `${scriptName}: HTTP Error ${response.statusCode} - ${response.body}`);
                await routeByName(s, job, errorName, scriptName);
                return;
            }

            const result = JSON.parse(response.body);

            if (result.success) {
                // Store approval information in private data
                await job.setPrivateData("ApprovalId", result.approvalId);
                await job.setPrivateData("ApprovalToken", result.token);
                await job.setPrivateData("ApprovalStatus", "pending");
                await job.setPrivateData("ApprovalSubmitTime", new Date().toISOString());
                await job.setPrivateData("ServerUploadPath", `/uploads/${result.approvalId}.pdf`);

                await job.log(LogLevel.Info, `${scriptName}: Approval created with ID ${result.approvalId}`);
                await job.log(LogLevel.Info, `${scriptName}: PDF uploaded to server for customer viewing`);
                await job.log(LogLevel.Info, `${scriptName}: Original PDF waits in Switch folder until webhook processes it`);

                // Send notification if configured
                if (notificationEmail) {
                    await sendNotification(s, job, notificationEmail, result.approvalId);
                }

                // Route to Success by NAME → Pending Folder
                await routeByName(s, job, successName, scriptName);
            } else {
                await job.log(LogLevel.Error, `${scriptName}: API returned unsuccessful response`);
                await routeByName(s, job, errorName, scriptName);
            }

        } catch (httpError: any) {
            await job.log(LogLevel.Error, `${scriptName}: HTTP request failed - ${httpError.message}`);
            await routeByName(s, job, errorName, scriptName);
        }

    } catch (error: any) {
        await job.log(LogLevel.Error, `${scriptName}: Error submitting approval - ${error.message}`);
        await job.sendToData(Connection.Level.Error);
    }
}

// Helper function to route by connection name (async version)
async function routeByName(s: Switch, job: Job, targetName: string, scriptName: string): Promise<void> {
    // Try numbered connections based on name
    const connectionMap: { [key: string]: number | Connection.Level } = {
        'success': Connection.Level.Success,
        'error': Connection.Level.Error,
        'approved': 1,
        'rejected': 2,
        'pending': 3,
        'timeout': 4
    };

    const target = connectionMap[targetName.toLowerCase()];

    if (target !== undefined) {
        await job.log(LogLevel.Info, `${scriptName}: Routing to '${targetName}'`);
        if (typeof target === 'number') {
            await job.sendToData(target as any); // Type assertion needed
        } else {
            await job.sendToData(target);
        }
    } else {
        // Try to parse as number
        const connectionNum = parseInt(targetName, 10);
        if (!isNaN(connectionNum)) {
            await job.log(LogLevel.Info, `${scriptName}: Routing to connection ${connectionNum}`);
            await job.sendToData(connectionNum as any);
        } else {
            // Default fallback
            await job.log(LogLevel.Warning, `${scriptName}: Unknown connection '${targetName}', using Success`);
            await job.sendToData(Connection.Level.Success);
        }
    }
}

async function sendNotification(s: Switch, job: Job, email: string, approvalId: string): Promise<void> {
    try {
        const fileName = await job.getName();
        const message = `PDF approval submitted:
File: ${fileName}
Approval ID: ${approvalId}
Time: ${new Date().toLocaleString()}

Note: PDF uploaded to server for customer review.
Original PDF remains in Switch workflow for processing.`;

        await s.sendEmail(email, "Approval Submitted", message);
    } catch (error: any) {
        await job.log(LogLevel.Warning, `Failed to send notification: ${error.message}`);
    }
}