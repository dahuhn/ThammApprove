import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';

export interface ApprovalAttributes {
  id: string;
  jobId: string;
  fileName: string;
  filePath: string;
  customerEmail: string;
  customerName?: string;
  status: 'pending' | 'approved' | 'rejected';
  token: string;
  comments?: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedReason?: string;
  metadata?: Record<string, any>;
  expiresAt: Date;
  switchFlowId?: string;
  switchJobId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ApprovalCreationAttributes extends Optional<ApprovalAttributes, 'id' | 'status' | 'createdAt' | 'updatedAt'> {}

export class Approval extends Model<ApprovalAttributes, ApprovalCreationAttributes> implements ApprovalAttributes {
  public id!: string;
  public jobId!: string;
  public fileName!: string;
  public filePath!: string;
  public customerEmail!: string;
  public customerName?: string;
  public status!: 'pending' | 'approved' | 'rejected';
  public token!: string;
  public comments?: string;
  public approvedBy?: string;
  public approvedAt?: Date;
  public rejectedReason?: string;
  public metadata?: Record<string, any>;
  public expiresAt!: Date;
  public switchFlowId?: string;
  public switchJobId?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Approval.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    jobId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: false
    },
    customerEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
      allowNull: false
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    approvedBy: {
      type: DataTypes.STRING,
      allowNull: true
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    rejectedReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    switchFlowId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    switchJobId: {
      type: DataTypes.STRING,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'Approval',
    tableName: 'approvals',
    indexes: [
      { fields: ['token'] },
      { fields: ['jobId'] },
      { fields: ['status'] },
      { fields: ['expiresAt'] }
    ]
  }
);