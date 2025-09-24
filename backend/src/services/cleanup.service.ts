import { Op } from 'sequelize';
import { unlink } from 'fs/promises';
import path from 'path';
import { Approval } from '../models/Approval.model';
import { logger } from '../utils/logger';

export async function cleanupExpiredApprovals() {
  try {
    const expiredApprovals = await Approval.findAll({
      where: {
        expiresAt: {
          [Op.lt]: new Date()
        },
        status: 'pending'
      }
    });

    for (const approval of expiredApprovals) {
      try {
        const filePath = path.join(process.env.UPLOAD_DIR || '../uploads', approval.filePath);
        await unlink(filePath);
        logger.info(`Deleted expired PDF file: ${approval.filePath}`);
      } catch (error) {
        logger.error(`Failed to delete file ${approval.filePath}:`, error);
      }

      await approval.update({ status: 'rejected', rejectedReason: 'Expired' });
    }

    if (expiredApprovals.length > 0) {
      logger.info(`Cleaned up ${expiredApprovals.length} expired approvals`);
    }
  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
}