// ThammApprove Webhook JSON Processor - ES5 Compatible
// Für Switch 2022+ kompatibel mit älteren JavaScript-Engines

function jobArrived(s, job) {
    var scriptName = "Webhook JSON Processor ES5";

    // Switch HTTP Element empfängt JSON als Job-Content, nicht als Datei
    s.log(1, scriptName + ": Starting webhook JSON processing");

    // Versuche Job-Path zu bekommen
    var jobPath = "";
    try {
        jobPath = job.getPath();
        s.log(1, scriptName + ": Job path: " + jobPath);
    } catch (pathError) {
        s.log(3, scriptName + ": Cannot get job path");
        job.sendToData(3, "", "");
        return;
    }

    // Versuche Webhook JSON Datei zu lesen
    var jsonContent = "";
    try {
        var file = new File(jobPath);
        s.log(1, scriptName + ": File exists check: " + (file.exists ? "YES" : "NO"));

        if (file.exists) {
            s.log(1, scriptName + ": File size: " + file.size);

            // Versuche readLines() - alle Zeilen in Array
            try {
                file.open(File.ReadOnly);
                var lines = file.readLines();
                file.close();

                if (lines && lines.length > 0) {
                    jsonContent = lines.join("");
                    s.log(1, scriptName + ": JSON read with readLines(), lines: " + lines.length + ", content: " + jsonContent);
                } else {
                    s.log(3, scriptName + ": readLines returned empty array");
                    jsonContent = "{}";
                }
            } catch (readLinesError) {
                s.log(3, scriptName + ": readLines failed, trying file.read()");
                // Fallback zu file.read()
                try {
                    file.open(File.ReadOnly);
                    var fileSize = file.size;
                    if (fileSize > 0 && fileSize < 10000) {
                        jsonContent = file.read(fileSize);
                        s.log(1, scriptName + ": Fallback file.read() success, size: " + fileSize);
                    } else {
                        jsonContent = "{}";
                    }
                    file.close();
                } catch (fallbackError) {
                    jsonContent = "{}";
                }
            }

            s.log(1, scriptName + ": JSON content: " + jsonContent);
        } else {
            s.log(3, scriptName + ": Webhook JSON file does not exist at: " + jobPath);
            job.sendToData(3, jobPath, "");
            return;
        }
    } catch (readError) {
        s.log(3, scriptName + ": File read error occurred");
        job.sendToData(3, jobPath, "");
        return;
    }

    // Versuche JSON zu parsen
    var webhookData = null;
    try {
        webhookData = JSON.parse(jsonContent);
        s.log(1, scriptName + ": JSON parsed OK");
    } catch (jsonError) {
        s.log(3, scriptName + ": JSON parse failed");
        job.sendToData(3, jobPath, "");
        return;
    }

    // Einfache Validierung
    if (!webhookData || !webhookData.status) {
        s.log(3, scriptName + ": Invalid webhook data");
        job.sendToData(3, jobPath, "");
        return;
    }

    s.log(1, scriptName + ": Status: " + webhookData.status);

    // Private Data für nachfolgende Switch-Elemente setzen (ULTRA ES5-safe)
    // Setze nur die Properties die definitiv vorhanden sind
    try {
        job.setPrivateData("WebhookJobId", webhookData.jobId || "");
    } catch (e) { /* ignore */ }

    try {
        job.setPrivateData("WebhookFileName", webhookData.fileName || "");
    } catch (e) { /* ignore */ }

    try {
        job.setPrivateData("WebhookStatus", webhookData.status || "");
    } catch (e) { /* ignore */ }

    try {
        job.setPrivateData("ApprovedBy", webhookData.approvedBy || "");
    } catch (e) { /* ignore */ }

    try {
        job.setPrivateData("ApprovedAt", webhookData.approvedAt || "");
    } catch (e) { /* ignore */ }

    try {
        job.setPrivateData("Comments", webhookData.comments || "");
    } catch (e) { /* ignore */ }

    try {
        job.setPrivateData("ApprovalToken", webhookData.token || "");
    } catch (e) { /* ignore */ }

    // Rejected properties - nur bei rejected status versuchen
    if (webhookData.status === "rejected") {
        try {
            job.setPrivateData("RejectedBy", webhookData.rejectedBy || "");
        } catch (e) { /* ignore */ }

        try {
            job.setPrivateData("RejectedAt", webhookData.rejectedAt || "");
        } catch (e) { /* ignore */ }

        try {
            job.setPrivateData("RejectedReason", webhookData.rejectedReason || "");
        } catch (e) { /* ignore */ }
    }

    s.log(1, scriptName + ": Private data set for downstream elements");

    // Routing basierend auf Status
    if (webhookData.status === 'approved') {
        s.log(1, scriptName + ": Routing to Approved");
        job.sendToData(1, jobPath, "");
    } else if (webhookData.status === 'rejected') {
        s.log(1, scriptName + ": Routing to Rejected");
        job.sendToData(2, jobPath, "");
    } else {
        s.log(3, scriptName + ": Unknown status, routing to Error");
        job.sendToData(3, jobPath, "");
    }
}

// Entry point for script start
function scriptStarted(s) {
    s.log(1, "Webhook JSON Processor ES5 started");
}

// Entry point for script stop
function scriptStopped(s) {
    s.log(1, "Webhook JSON Processor ES5 stopped");
}