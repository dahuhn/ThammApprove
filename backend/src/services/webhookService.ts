import axios from 'axios';
import { Approval } from '../models/Approval';

export interface SwitchWebhookPayload {
  jobId: string;
  status: 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectedReason?: string;
  comments?: string;
  token: string;
}

export class WebhookService {
  private switchWebhookUrl: string;
  private webhookEnabled: boolean;
  private webhookTimeout: number;
  private maxRetries: number;

  constructor() {
    this.switchWebhookUrl = process.env.SWITCH_WEBHOOK_URL || '';
    this.webhookEnabled = process.env.SWITCH_WEBHOOK_ENABLED === 'true';
    this.webhookTimeout = parseInt(process.env.SWITCH_WEBHOOK_TIMEOUT || '5000');
    this.maxRetries = parseInt(process.env.SWITCH_WEBHOOK_MAX_RETRIES || '3');
  }

  /**
   * Sends webhook notification to Switch when approval status changes
   */
  async sendToSwitch(approval: Approval): Promise<boolean> {
    if (!this.webhookEnabled || !this.switchWebhookUrl) {
      console.log('Switch webhook disabled or URL not configured');
      return false;
    }

    const payload: SwitchWebhookPayload = {
      jobId: approval.jobId,
      status: approval.status as 'approved' | 'rejected',
      token: approval.token
    };

    // Add status-specific fields
    if (approval.status === 'approved') {
      payload.approvedBy = approval.approvedBy || '';
      payload.approvedAt = approval.approvedAt?.toISOString() || '';
      payload.comments = approval.comments || '';
    } else if (approval.status === 'rejected') {
      payload.rejectedBy = approval.rejectedBy || '';
      payload.rejectedAt = approval.rejectedAt?.toISOString() || '';
      payload.rejectedReason = approval.rejectedReason || '';
      payload.comments = approval.comments || '';
    }

    return await this.sendWebhookWithRetry(payload);
  }

  /**
   * Sends webhook with retry logic
   */
  private async sendWebhookWithRetry(payload: SwitchWebhookPayload): Promise<boolean> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Sending webhook to Switch (attempt ${attempt}/${this.maxRetries}) for job ${payload.jobId}`);

        const response = await axios.post(this.switchWebhookUrl, payload, {
          timeout: this.webhookTimeout,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'ThammApprove-Webhook/1.0'
          }
        });

        if (response.status >= 200 && response.status < 300) {
          console.log(`✅ Webhook successfully sent to Switch for job ${payload.jobId}`);
          return true;
        } else {
          console.warn(`⚠️ Switch returned status ${response.status} for job ${payload.jobId}`);
        }

      } catch (error: any) {
        lastError = error;
        const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
        console.error(`❌ Webhook attempt ${attempt} failed for job ${payload.jobId}: ${errorMsg}`);

        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error(`🚨 All webhook attempts failed for job ${payload.jobId}. Switch will need to poll for status.`);

    // Log the error details for debugging
    if (lastError) {
      console.error('Last error details:', {
        message: lastError.message,
        code: lastError.code,
        status: lastError.response?.status,
        data: lastError.response?.data
      });
    }

    return false;
  }

  /**
   * Test webhook connectivity
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.webhookEnabled || !this.switchWebhookUrl) {
      return {
        success: false,
        message: 'Webhook disabled or URL not configured'
      };
    }

    try {
      const testPayload: SwitchWebhookPayload = {
        jobId: 'test-connection',
        status: 'approved',
        approvedBy: 'System Test',
        approvedAt: new Date().toISOString(),
        comments: 'Connection test',
        token: 'test-token'
      };

      const response = await axios.post(this.switchWebhookUrl, testPayload, {
        timeout: this.webhookTimeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ThammApprove-Webhook-Test/1.0'
        }
      });

      return {
        success: response.status >= 200 && response.status < 300,
        message: `Switch responded with status ${response.status}`
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }

  /**
   * Get webhook configuration info
   */
  getConfig() {
    return {
      enabled: this.webhookEnabled,
      url: this.switchWebhookUrl,
      timeout: this.webhookTimeout,
      maxRetries: this.maxRetries
    };
  }
}