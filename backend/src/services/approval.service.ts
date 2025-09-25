import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { Approval } from '../models/Approval.model';
import { logger } from '../utils/logger';

interface CreateApprovalData {
  jobId: string;
  fileName: string;
  filePath: string | null;  // NULL für Switch-only Approvals
  customerEmail: string;
  customerName?: string;
  switchFlowId?: string;
  switchJobId?: string;
  metadata?: Record<string, any>;
}

interface UpdateApprovalData {
  status: 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  rejectedReason?: string;
  comments?: string;
}

export async function createApproval(data: CreateApprovalData) {
  logger.info('Creating approval with data:', data);

  // JWT Secret prüfen
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  const token = jwt.sign(
    { jobId: data.jobId, type: 'approval' },
    process.env.JWT_SECRET!,
    { expiresIn: `${process.env.APPROVAL_EXPIRY_DAYS || 7}d` }
  );

  logger.info('JWT token generated:', {
    tokenLength: token.length,
    tokenStart: token.substring(0, 20) + '...'
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parseInt(process.env.APPROVAL_EXPIRY_DAYS || '7'));

  const createData = {
    ...data,
    token,
    expiresAt,
    status: 'pending'
  };

  logger.info('Data being sent to Approval.create:', {
    jobId: createData.jobId,
    hasToken: !!createData.token,
    tokenLength: createData.token?.length,
    status: createData.status
  });

  const approval = await Approval.create(createData);

  logger.info('Approval created in database:', {
    id: approval.id,
    jobId: approval.jobId,
    hasTokenAfterCreate: !!approval.token,
    tokenInDb: approval.token ? approval.token.substring(0, 20) + '...' : 'NULL'
  });

  logger.info(`Approval created for job ${data.jobId}`);
  return approval;
}

export async function getApproval(jobId: string) {
  return await Approval.findOne({ where: { jobId } });
}

export async function getApprovalByToken(token: string) {
  try {
    jwt.verify(token, process.env.JWT_SECRET!);
    return await Approval.findOne({ where: { token } });
  } catch (error) {
    logger.error('Invalid token:', error);
    return null;
  }
}

export async function updateApprovalStatus(jobId: string, data: UpdateApprovalData) {
  const approval = await Approval.findOne({ where: { jobId } });

  if (!approval) {
    throw new Error('Approval not found');
  }

  await approval.update(data);

  logger.info(`Approval ${jobId} updated to status: ${data.status}`);
  return approval;
}

export async function getPendingApprovals() {
  return await Approval.findAll({
    where: { status: 'pending' }
  });
}

export async function getExpiredApprovals() {
  const now = new Date();
  return await Approval.findAll({
    where: {
      status: 'pending',
      expiresAt: {
        [Op.lt]: now
      }
    }
  });
}