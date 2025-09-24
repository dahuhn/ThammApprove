#!/usr/bin/env node

/**
 * Webhook Test Tool für ThammApprove ↔ Switch Integration
 *
 * Testet die Webhook-Verbindung zwischen ThammApprove Backend und Switch
 *
 * Usage:
 *   node test-webhook.js --url http://172.16.0.67:9090/webhook
 *   node test-webhook.js --approved
 *   node test-webhook.js --rejected
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Default test configuration
const DEFAULT_CONFIG = {
  url: 'http://172.16.0.67:9090/webhook',
  timeout: 5000,
  userAgent: 'ThammApprove-WebhookTest/1.0'
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        config.url = args[++i];
        break;
      case '--timeout':
        config.timeout = parseInt(args[++i]);
        break;
      case '--approved':
        config.testType = 'approved';
        break;
      case '--rejected':
        config.testType = 'rejected';
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
    }
  }

  return config;
}

// Show help
function showHelp() {
  console.log(`
🔗 ThammApprove Webhook Test Tool

Usage:
  node test-webhook.js [options]

Options:
  --url <url>        Switch Webhook URL (default: ${DEFAULT_CONFIG.url})
  --timeout <ms>     Request timeout (default: ${DEFAULT_CONFIG.timeout}ms)
  --approved         Test approved webhook
  --rejected         Test rejected webhook
  --help             Show this help

Examples:
  node test-webhook.js
  node test-webhook.js --url http://192.168.1.100:9090/webhook
  node test-webhook.js --approved --timeout 10000
  node test-webhook.js --rejected
`);
}

// Generate test payload
function generatePayload(testType = 'approved') {
  const basePayload = {
    jobId: `test-${Date.now()}`,
    token: 'test-token-' + Math.random().toString(36).substr(2, 9)
  };

  if (testType === 'approved') {
    return {
      ...basePayload,
      status: 'approved',
      approvedBy: 'Test User',
      approvedAt: new Date().toISOString(),
      comments: 'Test approval from webhook test tool'
    };
  } else {
    return {
      ...basePayload,
      status: 'rejected',
      rejectedBy: 'Test User',
      rejectedAt: new Date().toISOString(),
      rejectedReason: 'Test rejection',
      comments: 'Test rejection from webhook test tool'
    };
  }
}

// Send HTTP request
function sendWebhook(config, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.url);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const postData = JSON.stringify(payload);

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': config.userAgent
      },
      timeout: config.timeout
    };

    console.log(`📤 Sending ${payload.status} webhook to: ${config.url}`);
    console.log(`📋 Payload:`, JSON.stringify(payload, null, 2));
    console.log(`⏱️  Timeout: ${config.timeout}ms\n`);

    const req = httpModule.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${config.timeout}ms`));
    });

    req.write(postData);
    req.end();
  });
}

// Format response for display
function formatResponse(response) {
  console.log(`📨 Response received:`);
  console.log(`   Status: ${response.statusCode} ${response.statusMessage}`);
  console.log(`   Headers:`, JSON.stringify(response.headers, null, 4));

  if (response.body) {
    try {
      const parsed = JSON.parse(response.body);
      console.log(`   Body:`, JSON.stringify(parsed, null, 4));
    } catch (e) {
      console.log(`   Body: ${response.body}`);
    }
  }

  return response.statusCode >= 200 && response.statusCode < 300;
}

// Main test function
async function runTest() {
  const config = parseArgs();

  console.log(`🚀 Starting webhook test...`);
  console.log(`🎯 Target: ${config.url}`);
  console.log(`📝 Test type: ${config.testType || 'approved'}\n`);

  try {
    const payload = generatePayload(config.testType);
    const response = await sendWebhook(config, payload);

    const success = formatResponse(response);

    if (success) {
      console.log(`\n✅ Webhook test SUCCESSFUL!`);
      console.log(`   Switch responded positively to ${payload.status} webhook`);
      process.exit(0);
    } else {
      console.log(`\n⚠️  Webhook test completed with warnings`);
      console.log(`   Switch returned status ${response.statusCode}`);
      console.log(`   This might be expected behavior - check Switch logs`);
      process.exit(1);
    }

  } catch (error) {
    console.log(`\n❌ Webhook test FAILED!`);

    if (error.code === 'ECONNREFUSED') {
      console.log(`   ❌ Connection refused - is Switch HTTP Server running?`);
      console.log(`   💡 Check: Switch HTTP Server Element on port ${new URL(config.url).port}`);
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      console.log(`   ⏰ Request timed out after ${config.timeout}ms`);
      console.log(`   💡 Try: --timeout 10000 for longer timeout`);
    } else if (error.code === 'ENOTFOUND') {
      console.log(`   🔍 Host not found: ${new URL(config.url).hostname}`);
      console.log(`   💡 Check: IP address and network connectivity`);
    } else {
      console.log(`   📄 Error: ${error.message}`);
      console.log(`   🔧 Code: ${error.code}`);
    }

    console.log(`\n🔧 Troubleshooting:`);
    console.log(`   1. Verify Switch HTTP Server Element is active`);
    console.log(`   2. Check port ${new URL(config.url).port} is open and accessible`);
    console.log(`   3. Confirm webhook-receiver-compatible.js is loaded`);
    console.log(`   4. Check Switch logs for errors`);
    console.log(`   5. Test with curl: curl -X POST ${config.url} -H "Content-Type: application/json" -d '{"test":true}'`);

    process.exit(2);
  }
}

// Test connectivity without sending webhook
async function testConnectivity(config) {
  console.log(`🔌 Testing basic connectivity to ${config.url}...`);

  try {
    const url = new URL(config.url);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: '/',
      method: 'HEAD',
      timeout: config.timeout
    };

    return new Promise((resolve, reject) => {
      const req = httpModule.request(options, (res) => {
        resolve(true);
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Connection timeout'));
      });

      req.end();
    });

  } catch (error) {
    return false;
  }
}

// Run the test
if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = { sendWebhook, generatePayload, formatResponse };