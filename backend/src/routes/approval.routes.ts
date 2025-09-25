import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createApproval, getApproval, updateApprovalStatus, getApprovalByToken } from '../services/approval.service';
import { sendApprovalEmail } from '../services/email.service';
import { WebhookService } from '../services/webhookService';
import { logger } from '../utils/logger';

const router = Router();
const webhookService = new WebhookService();

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

router.post('/create', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

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
      fileName: fileName || req.file.originalname,  // Use Switch filename if provided
      filePath: req.file.filename,
      customerEmail,
      customerName,
      switchFlowId,
      switchJobId,
      metadata: metadata ? JSON.parse(metadata) : {}
    });

    await sendApprovalEmail(approval);

    res.json({
      success: true,
      approvalId: approval.id,
      token: approval.token
    });
  } catch (error) {
    logger.error('Error creating approval:', error);
    res.status(500).json({ error: 'Failed to create approval' });
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
        const webhookSent = await webhookService.sendToSwitch(updated);
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
        const webhookSent = await webhookService.sendToSwitch(updated);
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
    const result = await webhookService.testConnection();
    const config = webhookService.getConfig();

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