import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createApproval, getApproval, updateApprovalStatus, getApprovalByToken } from '../services/approval.service';
import { sendApprovalEmail } from '../services/email.service';
import { WebhookService } from '../services/webhookService';
import { logger } from '../utils/logger';

const router = Router();
let webhookService: WebhookService | null = null;

function getWebhookService(): WebhookService {
  if (!webhookService) {
    webhookService = new WebhookService();
  }
  return webhookService;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || '../uploads');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800')
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Flexible Multer-Konfiguration für Switch HTTP API
const flexibleUpload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800')
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

router.post('/create', flexibleUpload.any(), async (req, res) => {
  try {
    // Flexibles File-Handling für upload.any()
    const pdfFile = req.files && req.files.length > 0 ? req.files[0] : null;

    if (!pdfFile) {
      logger.warn('No PDF file in request. Files:', req.files);
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    logger.info('Switch file upload:', {
      fieldname: pdfFile.fieldname,
      filename: pdfFile.filename,
      size: pdfFile.size
    });

    const {
      jobId,
      fileName,  // Original filename from Switch
      customerEmail,
      customerName,
      switchFlowId,
      switchJobId,
      metadata
    } = req.body;

    if (!jobId || !customerEmail) {
      return res.status(400).json({ error: 'JobId and customerEmail are required' });
    }

    const approval = await createApproval({
      jobId,
      fileName: fileName || pdfFile.originalname,  // Use Switch filename if provided
      filePath: pdfFile.path,  // Multer managed file path
      customerEmail,
      customerName,
      switchFlowId,
      switchJobId,
      metadata: metadata ? JSON.parse(metadata) : {}
    });

    // Debug: Prüfe Approval-Objekt direkt nach Erstellung
    logger.info('Approval data immediately after create:', {
      id: approval.id,
      jobId: approval.jobId,
      token: approval.token ? 'present' : 'MISSING',
      customerEmail: approval.customerEmail,
      fileName: approval.fileName,
      expiresAt: approval.expiresAt
    });

    // Versuche reload auf existierendem Objekt
    try {
      await approval.reload();
      logger.info('Approval data after reload:', {
        token: approval.token ? 'present' : 'STILL MISSING',
        expiresAt: approval.expiresAt
      });
    } catch (reloadError) {
      logger.error('Failed to reload approval:', reloadError.message);
    }

    // E-Mail-Versand (optional - falls SMTP nicht konfiguriert)
    try {
      await sendApprovalEmail(approval);
      logger.info('Approval email sent successfully');
    } catch (emailError) {
      logger.warn('Failed to send approval email:', {
        error: emailError.message,
        approvalId: approval.id,
        customerEmail: approval.customerEmail
      });
      // E-Mail-Fehler soll nicht die ganze Approval blockieren
    }

    res.json({
      success: true,
      approvalId: approval.id,
      token: approval.token
    });
  } catch (error) {
    logger.error('Error creating approval:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body,
      files: req.files,
      fileInfo: req.files && req.files.length > 0 ? {
        fieldname: req.files[0].fieldname,
        filename: req.files[0].filename,
        size: req.files[0].size,
        path: req.files[0].path
      } : 'No file'
    });
    res.status(500).json({
      error: 'Failed to create approval',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// JSON-basierte Route für Switch JavaScript (ohne Datei-Upload)
// NEW: Route für Switch Legacy HTTP.post mit Raw PDF Data
router.post('/create-raw', async (req, res) => {
  try {
    // PDF-Daten aus Request Body
    const pdfBuffer = req.body;

    // Metadaten aus Headers
    const jobId = req.headers['x-jobid'] as string;
    const fileName = req.headers['x-filename'] as string;
    const customerEmail = req.headers['x-customeremail'] as string;
    const customerName = req.headers['x-customername'] as string || '';
    const metadataHeader = req.headers['x-metadata'] as string;

    logger.info('Switch Raw PDF request:', { jobId, fileName, customerEmail, size: pdfBuffer.length });

    if (!jobId || !fileName || !customerEmail) {
      return res.status(400).json({ error: 'Missing required headers: X-JobId, X-FileName, X-CustomerEmail' });
    }

    let metadata = {};
    try {
      if (metadataHeader) {
        metadata = JSON.parse(metadataHeader);
      }
    } catch (e) {
      logger.warn('Failed to parse metadata header:', metadataHeader);
    }

    // PDF-Datei speichern
    const fs = require('fs');
    const path = require('path');
    const { v4: uuidv4 } = require('uuid');

    const uploadDir = process.env.UPLOAD_DIR || '../uploads';
    const uniqueName = `${uuidv4()}-${fileName}`;
    const filePath = path.join(uploadDir, uniqueName);

    // Stelle sicher, dass das Upload-Verzeichnis existiert
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    fs.writeFileSync(filePath, pdfBuffer);

    // Approval erstellen
    const approval = await createApproval({
      jobId,
      fileName,
      filePath,
      customerEmail,
      customerName,
      metadata
    });

    // E-Mail senden
    await sendApprovalEmail(
      customerEmail,
      approval.token,
      fileName,
      customerName
    );

    logger.info(`Switch Raw PDF approval created: ${approval.id}`);

    res.json({
      success: true,
      approvalId: approval.id,
      token: approval.token,
      message: 'Approval created successfully'
    });

  } catch (error) {
    logger.error('Switch Raw PDF creation error:', error);
    res.status(500).json({ error: 'Failed to create approval' });
  }
});

router.post('/create-json', async (req, res) => {
  try {
    const {
      jobId,
      fileName,
      customerEmail,
      customerName,
      metadata
    } = req.body;

    logger.info('Switch JSON request:', { jobId, fileName, customerEmail });

    if (!jobId || !customerEmail || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'JobId, fileName and customerEmail are required'
      });
    }

    // Erstelle Approval ohne Datei (die ist in Switch)
    const approval = await createApproval({
      jobId,
      fileName,
      filePath: null, // Keine Datei hier, die ist in Switch
      customerEmail,
      customerName: customerName || '',
      switchFlowId: '',
      switchJobId: jobId,
      metadata: metadata || {}
    });

    // E-Mail senden
    await sendApprovalEmail(approval);

    logger.info('Switch approval created:', { approvalId: approval.id });

    res.json({
      success: true,
      approvalId: approval.id,
      token: approval.token,
      message: 'Approval created successfully'
    });

  } catch (error) {
    logger.error('Error creating Switch approval:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create approval'
    });
  }
});

// Debug-Endpoint für Switch Development
router.post('/debug', async (req, res) => {
  try {
    logger.info('=== SWITCH DEBUG REQUEST ===');
    logger.info('Headers:', req.headers);
    logger.info('Body:', req.body);
    logger.info('Method:', req.method);
    logger.info('URL:', req.url);
    logger.info('============================');

    const debugInfo = {
      timestamp: new Date().toISOString(),
      received: req.body,
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent'],
      ip: req.ip
    };

    res.json({
      success: true,
      message: 'Debug request received successfully',
      debug: debugInfo,
      approvalId: `debug_${Date.now()}`,
      token: 'debug-token-123'
    });

  } catch (error) {
    logger.error('Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Debug endpoint failed'
    });
  }
});

router.get('/status/:jobId', async (req, res) => {
  try {
    const approval = await getApproval(req.params.jobId);

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json({
      id: approval.id,
      jobId: approval.jobId,
      status: approval.status,
      fileName: approval.fileName,
      approvedBy: approval.approvedBy,
      approvedAt: approval.approvedAt,
      rejectedReason: approval.rejectedReason,
      comments: approval.comments
    });
  } catch (error) {
    logger.error('Error getting approval status:', error);
    res.status(500).json({ error: 'Failed to get approval status' });
  }
});

router.get('/view/:token', async (req, res) => {
  try {
    const approval = await getApprovalByToken(req.params.token);

    if (!approval) {
      return res.status(404).json({ error: 'Invalid or expired approval link' });
    }

    if (new Date() > approval.expiresAt) {
      return res.status(410).json({ error: 'Approval link has expired' });
    }

    res.json({
      id: approval.id,
      fileName: approval.fileName,
      filePath: `/uploads/${approval.filePath}`,
      status: approval.status,
      customerName: approval.customerName,
      metadata: approval.metadata,
      expiresAt: approval.expiresAt
    });
  } catch (error) {
    logger.error('Error viewing approval:', error);
    res.status(500).json({ error: 'Failed to load approval' });
  }
});

router.post('/approve/:token', async (req, res) => {
  try {
    const { approvedBy, comments } = req.body;

    const approval = await getApprovalByToken(req.params.token);

    if (!approval) {
      return res.status(404).json({ error: 'Invalid approval link' });
    }

    if (new Date() > approval.expiresAt) {
      return res.status(410).json({ error: 'Approval link has expired' });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({ error: 'Approval already processed' });
    }

    const updated = await updateApprovalStatus(approval.jobId, {
      status: 'approved',
      approvedBy: approvedBy || approval.customerEmail,
      approvedAt: new Date(),
      comments
    });

    // Send webhook to Switch immediately
    if (updated) {
      try {
        const webhookSent = await getWebhookService().sendToSwitch(updated);
        if (webhookSent) {
          logger.info(`✅ Webhook sent to Switch for approved job ${updated.jobId}`);
        } else {
          logger.warn(`⚠️ Webhook failed for job ${updated.jobId}, Switch will poll for status`);
        }
      } catch (error) {
        logger.error('Webhook error:', error);
      }
    }

    res.json({
      success: true,
      message: 'PDF approved successfully'
    });
  } catch (error) {
    logger.error('Error approving:', error);
    res.status(500).json({ error: 'Failed to approve' });
  }
});

router.post('/reject/:token', async (req, res) => {
  try {
    const { rejectedReason, comments } = req.body;

    const approval = await getApprovalByToken(req.params.token);

    if (!approval) {
      return res.status(404).json({ error: 'Invalid approval link' });
    }

    if (new Date() > approval.expiresAt) {
      return res.status(410).json({ error: 'Approval link has expired' });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({ error: 'Approval already processed' });
    }

    const updated = await updateApprovalStatus(approval.jobId, {
      status: 'rejected',
      rejectedReason,
      comments
    });

    // Send webhook to Switch immediately
    if (updated) {
      try {
        const webhookSent = await getWebhookService().sendToSwitch(updated);
        if (webhookSent) {
          logger.info(`✅ Webhook sent to Switch for rejected job ${updated.jobId}`);
        } else {
          logger.warn(`⚠️ Webhook failed for job ${updated.jobId}, Switch will poll for status`);
        }
      } catch (error) {
        logger.error('Webhook error:', error);
      }
    }

    res.json({
      success: true,
      message: 'PDF rejected'
    });
  } catch (error) {
    logger.error('Error rejecting:', error);
    res.status(500).json({ error: 'Failed to reject' });
  }
});

// Test endpoint for webhook connectivity
router.get('/webhook/test', async (req, res) => {
  try {
    const result = await getWebhookService().testConnection();
    const config = getWebhookService().getConfig();

    res.json({
      webhookTest: result,
      configuration: config
    });
  } catch (error) {
    logger.error('Webhook test error:', error);
    res.status(500).json({ error: 'Webhook test failed' });
  }
});

export default router;