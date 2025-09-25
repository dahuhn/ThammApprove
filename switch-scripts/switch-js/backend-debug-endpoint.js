// Backend Debug-Endpoint für Switch Script Testing
// Füge das zu deinen Backend-Routes hinzu

// In approval.routes.ts
router.post('/debug', async (req, res) => {
    console.log('=== SWITCH DEBUG REQUEST ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('============================');

    // Log alle empfangenen Daten
    const debugInfo = {
        timestamp: new Date().toISOString(),
        received: req.body,
        contentType: req.headers['content-type'],
        userAgent: req.headers['user-agent']
    };

    console.log('Debug Info:', debugInfo);

    // Erfolgreiche Antwort senden
    res.json({
        success: true,
        message: 'Debug request received successfully',
        debug: debugInfo,
        approvalId: `debug_${Date.now()}`,
        token: 'debug-token-123'
    });
});