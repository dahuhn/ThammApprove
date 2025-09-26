// Enfocus Switch Script: Submit PDF for Approval with Order Collection Support
// Erweiterte Version für Auftragssammlung nach Kunden und Materialien
// WICHTIG: Nutzt Named Connections mit bewährter ES5 API!

function jobArrived(s, job) {
    var scriptName = "ThammApprove Submit (Order Collection)";

    try {
        // Get configuration from Switch flow element properties (BEWÄHRTE API)
        var apiUrl = s.getPropertyValue("apiUrl") || "http://172.16.0.66:3101";
        job.log(1, scriptName + ": Using API URL: " + apiUrl);

        var customerEmail = s.getPropertyValue("customerEmail") || job.getPrivateData("CustomerEmail");
        var customerName = s.getPropertyValue("customerName") || job.getPrivateData("CustomerName");

        // NEW: Order Collection Parameters from Private Data
        var orderNumber = job.getPrivateData("Auftragsnummer");
        var material = job.getPrivateData("Material");

        // Cast Positionsnummer to integer (can be string or number in Private Data)
        var positionNumberRaw = job.getPrivateData("Positionsnummer");
        var positionNumber = null;
        if (positionNumberRaw !== null && positionNumberRaw !== undefined && positionNumberRaw !== "") {
            positionNumber = parseInt(String(positionNumberRaw), 10);
            if (isNaN(positionNumber)) {
                job.log(2, scriptName + ": Warning: Positionsnummer '" + positionNumberRaw + "' is not a valid number");
                positionNumber = null;
            }
        }

        job.log(1, scriptName + ": Customer Email: " + (customerEmail || "NOT SET"));
        job.log(1, scriptName + ": Customer Name: " + (customerName || "NOT SET"));
        job.log(1, scriptName + ": Order Number: " + (orderNumber || "NOT SET"));
        job.log(1, scriptName + ": Material: " + (material || "NOT SET"));
        job.log(1, scriptName + ": Position Number: " + (positionNumber || "NOT SET"));

        // CONNECTION NAMES - können in Properties definiert werden
        var successName = s.getPropertyValue("successName") || "Success";
        var errorName = s.getPropertyValue("errorName") || "Error";

        // Validate required fields
        if (!customerEmail) {
            job.log(3, scriptName + ": Customer email is required - set customerEmail property or CustomerEmail private data");
            routeByName(s, job, errorName, scriptName);
            return;
        }

        // Get job information (BEWÄHRTE API)
        var jobPath = job.getPath();
        var fileName = job.getName();
        var jobId = job.getName() + "_" + new Date().getTime();

        // Store original filename for later webhook processing
        job.setPrivateData("OriginalFileName", fileName);

        // Prepare metadata (erweitert für Order Collection)
        var metadata = {
            submitTime: toISOString(new Date()),
            originalPath: jobPath,
            fileName: fileName,
            // Order Collection Metadata
            orderNumber: orderNumber,
            material: material,
            positionNumber: positionNumber
        };

        // Switch HTTP API: Korrekte Implementierung basierend auf Dokumentation
        job.log(1, scriptName + ": Submitting " + fileName + " for approval via HTTP API");

        var http = new HTTP();

        // HTTP Setup laut Switch Dokumentation
        http.url = apiUrl + "/api/approvals/create";

        // Datei anhängen mit setAttachedFile()
        http.setAttachedFile(jobPath);

        // Standard Parameter hinzufügen mit addParameter()
        http.addParameter("jobId", jobId);
        http.addParameter("fileName", fileName);
        http.addParameter("customerEmail", customerEmail);
        http.addParameter("customerName", customerName || "");
        http.addParameter("metadata", JSON.stringify(metadata));

        // NEW: Order Collection Parameters
        if (orderNumber) {
            http.addParameter("orderNumber", orderNumber);
            job.log(1, scriptName + ": Added order number parameter: " + orderNumber);
        }

        if (material) {
            http.addParameter("material", material);
            job.log(1, scriptName + ": Added material parameter: " + material);
        }

        if (positionNumber && !isNaN(positionNumber)) {
            http.addParameter("positionNumber", String(positionNumber));
            job.log(1, scriptName + ": Added position number parameter: " + positionNumber);
        }

        // enableMime = true für multipart/form-data (wie FormData)
        http.enableMime = true;

        job.log(1, scriptName + ": Starting HTTP POST with attached file");

        // POST Request starten (asynchron)
        http.post();

        // Auf Completion warten (30 Sekunden Timeout)
        var success = http.waitForFinished(30000);

        if (!success) {
            job.log(3, scriptName + ": HTTP request timeout after 30 seconds");
            routeByName(s, job, errorName, scriptName);
            return;
        }

        // Response holen
        var responseData = http.getServerResponse();
        var statusCode = http.finishedStatus;

        job.log(1, scriptName + ": HTTP finished with status " + statusCode);

        // SByteArray zu String konvertieren (Switch ES5 spezifisch)
        var responseString = "";
        try {
            if (responseData && typeof responseData.toString === 'function') {
                responseString = responseData.toString();
            } else {
                responseString = String(responseData || "Empty response");
            }
        } catch (convertError) {
            responseString = "Response conversion failed";
        }

        job.log(1, scriptName + ": Response data: " + responseString.substring(0, 200) + "...");

        // Response verarbeiten
        try {
            // Switch gibt "Ok" oder 200 bei Erfolg zurück
            var statusString = String(statusCode).toLowerCase();
            var isSuccess = (statusString === "ok" || statusCode === 200 || statusCode === "200");

            if (!isSuccess) {
                job.log(3, scriptName + ": HTTP Error " + statusCode + " - " + responseString);
                routeByName(s, job, errorName, scriptName);
                return;
            }

            // Auch bei Status 200 kann es Backend-Fehler geben
            if (responseString.indexOf('"error"') !== -1) {
                job.log(3, scriptName + ": Backend Error Response: " + responseString);
                routeByName(s, job, errorName, scriptName);
                return;
            }

            var result = JSON.parse(responseString);

            // Debug logging
            job.log(1, scriptName + ": Parsed result type: " + typeof result);
            job.log(1, scriptName + ": Result has success: " + (result && result.success));
            job.log(1, scriptName + ": Result has approvalId: " + (result && result.approvalId));

            if (result && result.success) {
                // Store approval information in private data (with null checks)
                if (result.approvalId) {
                    job.setPrivateData("ApprovalId", result.approvalId);
                    job.log(1, scriptName + ": Stored ApprovalId: " + result.approvalId);
                }
                if (result.token) {
                    job.setPrivateData("ApprovalToken", result.token);
                    job.log(1, scriptName + ": Stored ApprovalToken (length): " + result.token.length);
                }
                job.setPrivateData("ApprovalStatus", "pending");
                job.setPrivateData("ApprovalSubmitTime", toISOString(new Date()));

                // Store order collection information
                if (orderNumber) {
                    job.setPrivateData("ApprovalOrderNumber", orderNumber);
                }

                if (result.approvalId) {
                    job.log(1, scriptName + ": Approval created with ID " + result.approvalId);
                } else {
                    job.log(1, scriptName + ": Approval created (ID not provided in response)");
                }

                // Email throttling info
                if (orderNumber && !result.shouldSendEmail) {
                    job.log(1, scriptName + ": Email throttling active for order " + orderNumber);
                    job.log(1, scriptName + ": No individual email sent - order collection email already sent");
                } else if (orderNumber && result.shouldSendEmail) {
                    job.log(1, scriptName + ": Order collection email sent for order " + orderNumber);
                }

                job.log(1, scriptName + ": PDF uploaded via Switch HTTP API");
                job.log(1, scriptName + ": Original PDF waits in Switch folder until webhook processes it");

                // Backend sends approval emails automatically - no need for Switch notification

                // Route to Success by NAME → Pending Folder
                routeByName(s, job, successName, scriptName);
                return; // WICHTIG: Beende hier, um doppeltes Routing zu verhindern!
            } else {
                job.log(3, scriptName + ": API returned unsuccessful response");
                routeByName(s, job, errorName, scriptName);
                return;
            }

        } catch (parseError) {
            // SAFE ERROR HANDLING - kein Property-Zugriff
            job.log(3, scriptName + ": Error parsing API response - " + String(parseError || "Parse failed"));
            routeByName(s, job, errorName, scriptName);
            return; // KRITISCH: Verhindert doppeltes Routing!
        }

    } catch (error) {
        // SAFE ERROR HANDLING - kein Property-Zugriff
        job.log(3, scriptName + ": Error submitting approval - " + String(error || "Unknown error"));
        routeByName(s, job, "Error", scriptName);
        return; // KRITISCH: Verhindert doppeltes Routing!
    }
}

// Helper function - Switch ES5 Date ist problematisch, verwende einfachen String
function toISOString(date) {
    // Switch ES5 hat Date-Probleme - verwende einfachen Timestamp
    var timestamp = String(date || "unknown");
    return timestamp.replace(/\s/g, 'T') + 'Z';
}

// VEREINFACHTE Helper function to route by connection name
function routeByName(s, job, targetName, scriptName) {
    job.log(1, scriptName + ": Looking for connection named '" + targetName + "'");

    // Switch ES5 sendToData mit Pfad (int, QString, QString)
    var jobPath = job.getPath();

    if (targetName.toLowerCase() === "success") {
        job.log(1, scriptName + ": Routing to Success connection");
        job.sendToData(1, jobPath, "");  // sendToData(int, QString, QString)
        return;
    }

    if (targetName.toLowerCase() === "error") {
        job.log(1, scriptName + ": Routing to Error connection");
        job.sendToData(3, jobPath, "");  // sendToData(int, QString, QString) - Error = 3
        return;
    }

    // Fallback: Try to parse as number
    var connectionNum = parseInt(targetName, 10);
    if (!isNaN(connectionNum)) {
        job.log(1, scriptName + ": Using connection number " + connectionNum);
        job.sendToData(connectionNum, jobPath, "");
        return;
    }

    // Ultimate fallback
    job.log(3, scriptName + ": Could not find connection named '" + targetName + "', using Success");
    job.sendToData(1, jobPath, "");
}