import { Order } from '../models/Order.model';
import { Approval } from '../models/Approval.model';
import { Op } from 'sequelize';
import { logger } from '../utils/logger';

export interface CreateOrderData {
  orderNumber: string;
  customerEmail: string;
  customerName?: string;
  emailThrottleMinutes?: number;
}

export interface OrderCollectionView {
  order: Order;
  approvals: Approval[];
  groupedByMaterial: { [material: string]: Approval[] };
  statistics: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    progress: number;
  };
}

export class OrderService {

  /**
   * Find or create order by order number
   */
  async findOrCreateOrder(data: CreateOrderData): Promise<Order> {
    const [order, created] = await Order.findOrCreate({
      where: { orderNumber: data.orderNumber },
      defaults: {
        orderNumber: data.orderNumber,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        emailThrottleMinutes: data.emailThrottleMinutes || 60,
        status: 'pending'
      }
    });

    if (!created) {
      // Update customer info if different (might have changed)
      if (order.customerEmail !== data.customerEmail || order.customerName !== data.customerName) {
        order.customerEmail = data.customerEmail;
        order.customerName = data.customerName;
        await order.save();
        logger.info(`Updated customer info for order ${data.orderNumber}`);
      }
    } else {
      logger.info(`Created new order ${data.orderNumber} for ${data.customerEmail}`);
    }

    return order;
  }

  /**
   * Check if order can receive email (throttling)
   */
  async canSendEmail(orderNumber: string): Promise<boolean> {
    const order = await Order.findOne({ where: { orderNumber } });
    if (!order) return true; // New order, can send email

    return order.canSendEmail();
  }

  /**
   * Mark email as sent for order
   */
  async markEmailSent(orderNumber: string): Promise<void> {
    const order = await Order.findOne({ where: { orderNumber } });
    if (order) {
      await order.markEmailSent();
      logger.info(`Email throttling activated for order ${orderNumber} for ${order.emailThrottleMinutes} minutes`);
    }
  }

  /**
   * Get order collection by secure token
   */
  async getOrderCollectionByToken(token: string): Promise<OrderCollectionView | null> {
    const order = await Order.findOne({
      where: { orderToken: token },
      include: [{
        model: Approval,
        as: 'approvals',
        required: false
      }]
    });

    if (!order) return null;

    const approvals = await order.getApprovals({
      order: [['positionNumber', 'ASC'], ['createdAt', 'ASC']]
    });

    // Group by material
    const groupedByMaterial: { [material: string]: Approval[] } = {};
    approvals.forEach(approval => {
      const material = approval.material || 'Unbekanntes Material';
      if (!groupedByMaterial[material]) {
        groupedByMaterial[material] = [];
      }
      groupedByMaterial[material].push(approval);
    });

    // Calculate statistics
    const total = approvals.length;
    const pending = approvals.filter(a => a.status === 'pending').length;
    const approved = approvals.filter(a => a.status === 'approved').length;
    const rejected = approvals.filter(a => a.status === 'rejected').length;
    const progress = total > 0 ? Math.round(((approved + rejected) / total) * 100) : 0;

    return {
      order,
      approvals,
      groupedByMaterial,
      statistics: {
        total,
        pending,
        approved,
        rejected,
        progress
      }
    };
  }

  /**
   * Get order with all approvals for collection view
   */
  async getOrderCollection(orderNumber: string): Promise<OrderCollectionView | null> {
    const order = await Order.findOne({
      where: { orderNumber },
      include: [{
        model: Approval,
        as: 'approvals',
        required: false
      }]
    });

    if (!order) return null;

    const approvals = await order.getApprovals({
      order: [['positionNumber', 'ASC'], ['createdAt', 'ASC']]
    });

    // Group by material
    const groupedByMaterial: { [material: string]: Approval[] } = {};
    approvals.forEach(approval => {
      const material = approval.material || 'Unbekanntes Material';
      if (!groupedByMaterial[material]) {
        groupedByMaterial[material] = [];
      }
      groupedByMaterial[material].push(approval);
    });

    // Calculate statistics
    const total = approvals.length;
    const pending = approvals.filter(a => a.status === 'pending').length;
    const approved = approvals.filter(a => a.status === 'approved').length;
    const rejected = approvals.filter(a => a.status === 'rejected').length;
    const progress = total > 0 ? Math.round(((approved + rejected) / total) * 100) : 0;

    return {
      order,
      approvals,
      groupedByMaterial,
      statistics: {
        total,
        pending,
        approved,
        rejected,
        progress
      }
    };
  }

  /**
   * Get orders by customer for dashboard
   */
  async getOrdersByCustomer(customerEmail: string): Promise<Order[]> {
    return await Order.findAll({
      where: { customerEmail },
      include: [{
        model: Approval,
        as: 'approvals',
        required: false
      }],
      order: [['createdAt', 'DESC']]
    });
  }

  /**
   * Update order status based on approvals
   */
  async updateOrderStatus(orderNumber: string): Promise<void> {
    const order = await Order.findOne({ where: { orderNumber } });
    if (order) {
      await order.updateStatus();
      logger.info(`Order ${orderNumber} status updated to: ${order.status}`);
    }
  }

  /**
   * Bulk approve approvals for order
   */
  async bulkApprove(orderNumber: string, approvalIds: string[], approvedBy: string, comments?: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const approvalId of approvalIds) {
      try {
        const approval = await Approval.findOne({
          where: {
            id: approvalId,
            orderNumber: orderNumber,
            status: 'pending'
          }
        });

        if (approval) {
          approval.status = 'approved';
          approval.approvedBy = approvedBy;
          approval.approvedAt = new Date();
          if (comments) approval.comments = comments;

          await approval.save();
          success++;
          logger.info(`Bulk approved: ${approval.fileName} by ${approvedBy}`);
        } else {
          failed++;
          logger.warn(`Could not find pending approval ${approvalId} for order ${orderNumber}`);
        }
      } catch (error) {
        failed++;
        logger.error(`Error bulk approving ${approvalId}:`, error);
      }
    }

    // Update order status after bulk operation
    await this.updateOrderStatus(orderNumber);

    return { success, failed };
  }

  /**
   * Bulk reject approvals for order
   */
  async bulkReject(orderNumber: string, approvalIds: string[], rejectedBy: string, rejectedReason: string, comments?: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const approvalId of approvalIds) {
      try {
        const approval = await Approval.findOne({
          where: {
            id: approvalId,
            orderNumber: orderNumber,
            status: 'pending'
          }
        });

        if (approval) {
          approval.status = 'rejected';
          approval.rejectedBy = rejectedBy;
          approval.rejectedAt = new Date();
          approval.rejectedReason = rejectedReason;
          if (comments) approval.comments = comments;

          await approval.save();
          success++;
          logger.info(`Bulk rejected: ${approval.fileName} by ${rejectedBy}`);
        } else {
          failed++;
          logger.warn(`Could not find pending approval ${approvalId} for order ${orderNumber}`);
        }
      } catch (error) {
        failed++;
        logger.error(`Error bulk rejecting ${approvalId}:`, error);
      }
    }

    // Update order status after bulk operation
    await this.updateOrderStatus(orderNumber);

    return { success, failed };
  }

  /**
   * Get material statistics for order
   */
  async getMaterialStatistics(orderNumber: string): Promise<{ [material: string]: { total: number; approved: number; rejected: number; pending: number } }> {
    const approvals = await Approval.findAll({
      where: { orderNumber },
      attributes: ['material', 'status']
    });

    const stats: { [material: string]: { total: number; approved: number; rejected: number; pending: number } } = {};

    approvals.forEach(approval => {
      const material = approval.material || 'Unbekanntes Material';

      if (!stats[material]) {
        stats[material] = { total: 0, approved: 0, rejected: 0, pending: 0 };
      }

      stats[material].total++;

      switch (approval.status) {
        case 'approved':
          stats[material].approved++;
          break;
        case 'rejected':
          stats[material].rejected++;
          break;
        case 'pending':
          stats[material].pending++;
          break;
      }
    });

    return stats;
  }

  /**
   * Search orders with filters
   */
  async searchOrders(filters: {
    customerEmail?: string;
    status?: string;
    orderNumber?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }, limit: number = 50, offset: number = 0): Promise<{ orders: Order[]; total: number }> {
    const where: any = {};

    if (filters.customerEmail) {
      where.customerEmail = { [Op.like]: `%${filters.customerEmail}%` };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.orderNumber) {
      where.orderNumber = { [Op.like]: `%${filters.orderNumber}%` };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt[Op.gte] = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt[Op.lte] = filters.dateTo;
      }
    }

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [{
        model: Approval,
        as: 'approvals',
        required: false
      }],
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    return { orders: rows, total: count };
  }

  /**
   * Delete order and all associated approvals
   */
  async deleteOrder(orderNumber: string): Promise<void> {
    logger.info(`Deleting order ${orderNumber} and all associated approvals`);

    // First delete all approvals for this order
    const deletedApprovals = await Approval.destroy({
      where: { orderNumber }
    });

    logger.info(`Deleted ${deletedApprovals} approvals for order ${orderNumber}`);

    // Then delete the order
    const deletedOrders = await Order.destroy({
      where: { orderNumber }
    });

    logger.info(`Deleted ${deletedOrders} orders with number ${orderNumber}`);
  }
}

// Export singleton instance
export const orderService = new OrderService();