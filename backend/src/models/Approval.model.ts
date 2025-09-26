import { DataTypes, Model, Optional, BelongsToGetAssociationMixin, Association } from 'sequelize';
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
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectedReason?: string;
  metadata?: Record<string, any>;
  expiresAt: Date;
  switchFlowId?: string;
  switchJobId?: string;
  // NEW: Order Collection Fields
  orderNumber?: string;
  orderId?: string;
  material?: string;
  positionNumber?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ApprovalCreationAttributes extends Optional<ApprovalAttributes, 'id' | 'status' | 'createdAt' | 'updatedAt'> {}

export class Approval extends Model<ApprovalAttributes, ApprovalCreationAttributes> implements ApprovalAttributes {
  declare id: string;
  declare jobId: string;
  declare fileName: string;
  declare filePath: string;
  declare customerEmail: string;
  declare customerName?: string;
  declare status: 'pending' | 'approved' | 'rejected';
  declare token: string;
  declare comments?: string;
  declare approvedBy?: string;
  declare approvedAt?: Date;
  declare rejectedBy?: string;
  declare rejectedAt?: Date;
  declare rejectedReason?: string;
  declare metadata?: Record<string, any>;
  declare expiresAt: Date;
  declare switchFlowId?: string;
  declare switchJobId?: string;
  // NEW: Order Collection Fields
  declare orderNumber?: string;
  declare orderId?: string;
  declare material?: string;
  declare positionNumber?: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Association mixins
  declare getOrder: BelongsToGetAssociationMixin<any>; // Will import Order type later

  // Associations
  declare static associations: {
    order: Association<Approval, any>; // Will type properly later
  };
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
    rejectedBy: {
      type: DataTypes.STRING,
      allowNull: true
    },
    rejectedAt: {
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
    },
    // NEW: Order Collection Fields
    orderNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        notEmpty: true
      }
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'orders',
        key: 'id'
      }
    },
    material: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        notEmpty: true
      }
    },
    positionNumber: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1
      }
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
      { fields: ['expiresAt'] },
      // NEW: Order Collection Indexes
      { fields: ['orderNumber'] },
      { fields: ['orderId'] },
      { fields: ['material'] },
      { fields: ['positionNumber'] },
      { fields: ['orderNumber', 'positionNumber'] },
      { fields: ['orderNumber', 'material'] }
    ]
  }
);