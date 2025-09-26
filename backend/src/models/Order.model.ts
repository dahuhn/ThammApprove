import { DataTypes, Model, Optional, HasManyGetAssociationsMixin, Association } from 'sequelize';
import { sequelize } from '../database/connection';
import { Approval } from './Approval.model';
import crypto from 'crypto';

export interface OrderAttributes {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerName?: string;
  lastEmailSent?: Date;
  emailThrottleMinutes: number;
  status: 'pending' | 'partial' | 'completed' | 'cancelled';
  orderToken?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface OrderCreationAttributes extends Optional<OrderAttributes, 'id' | 'status' | 'emailThrottleMinutes' | 'createdAt' | 'updatedAt'> {}

export class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  declare id: string;
  declare orderNumber: string;
  declare customerEmail: string;
  declare customerName?: string;
  declare lastEmailSent?: Date;
  declare emailThrottleMinutes: number;
  declare status: 'pending' | 'partial' | 'completed' | 'cancelled';
  declare orderToken?: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Association mixins
  declare getApprovals: HasManyGetAssociationsMixin<Approval>;

  // Associations
  declare static associations: {
    approvals: Association<Order, Approval>;
  };

  /**
   * Check if order can receive a new email (throttling check)
   */
  canSendEmail(): boolean {
    if (!this.lastEmailSent) return true;

    const now = new Date();
    const throttleMs = this.emailThrottleMinutes * 60 * 1000;
    const timeSinceLastEmail = now.getTime() - this.lastEmailSent.getTime();

    return timeSinceLastEmail >= throttleMs;
  }

  /**
   * Mark email as sent
   */
  async markEmailSent(): Promise<void> {
    this.lastEmailSent = new Date();
    await this.save();
  }

  /**
   * Update order status based on approvals
   */
  async updateStatus(): Promise<void> {
    const approvals = await this.getApprovals();

    if (approvals.length === 0) {
      this.status = 'pending';
      return;
    }

    const approvedCount = approvals.filter(a => a.status === 'approved').length;
    const rejectedCount = approvals.filter(a => a.status === 'rejected').length;
    const pendingCount = approvals.filter(a => a.status === 'pending').length;

    if (rejectedCount > 0) {
      this.status = 'cancelled';
    } else if (pendingCount === 0 && approvedCount === approvals.length) {
      this.status = 'completed';
    } else if (approvedCount > 0) {
      this.status = 'partial';
    } else {
      this.status = 'pending';
    }

    await this.save();
  }

  /**
   * Generate secure order token
   */
  generateOrderToken(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(16).toString('hex');
    const payload = `${this.orderNumber}-${timestamp}-${random}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Ensure order has a token
   */
  async ensureToken(): Promise<string> {
    if (!this.orderToken) {
      this.orderToken = this.generateOrderToken();
      await this.save();
    }
    return this.orderToken;
  }
}

Order.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
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
    lastEmailSent: {
      type: DataTypes.DATE,
      allowNull: true
    },
    emailThrottleMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 60, // 1 hour default throttle
      validate: {
        min: 0,
        max: 10080 // Max 1 week
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'partial', 'completed', 'cancelled'),
      defaultValue: 'pending',
      allowNull: false
    },
    orderToken: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        len: [32, 512] // JWT tokens are typically longer
      }
    }
  },
  {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
    indexes: [
      { fields: ['orderNumber'], unique: true },
      { fields: ['customerEmail'] },
      { fields: ['status'] },
      { fields: ['lastEmailSent'] }
    ]
  }
);