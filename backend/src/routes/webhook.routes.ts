import { Router } from 'express';
import { getApproval } from '../services/approval.service';
import { logger } from '../utils/logger';

const router = Router();

router.post('/switch-callback', async (req, res) => {
  try {
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'JobId is required' });
    }

    const approval = await getApproval(jobId);

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json({
      jobId: approval.jobId,
      status: approval.status,
      approvedBy: approval.approvedBy,
      approvedAt: approval.approvedAt,
      rejectedReason: approval.rejectedReason,
      comments: approval.comments,
      metadata: approval.metadata
    });
  } catch (error) {
    logger.error('Error in webhook callback:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;