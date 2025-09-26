import { Router } from 'express';
import { orderService } from '../services/order.service';
import { logger } from '../utils/logger';

const router = Router();

// Get order collection view by token (SECURE)
router.get('/collection/token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const collection = await orderService.getOrderCollectionByToken(token);

    if (!collection) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or token invalid'
      });
    }

    res.json({
      success: true,
      data: collection
    });

  } catch (error) {
    logger.error('Error getting order collection by token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order collection'
    });
  }
});

// DEPRECATED: Get order collection view by order number (INSECURE - for backward compatibility only)
router.get('/collection/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    // Log security warning
    logger.warn('SECURITY WARNING: Order collection accessed by order number instead of token', {
      orderNumber,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const collection = await orderService.getOrderCollection(orderNumber);

    if (!collection) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: collection
    });

  } catch (error) {
    logger.error('Error getting order collection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order collection'
    });
  }
});

// Get orders by customer
router.get('/customer/:customerEmail', async (req, res) => {
  try {
    const { customerEmail } = req.params;

    const orders = await orderService.getOrdersByCustomer(customerEmail);

    res.json({
      success: true,
      data: orders
    });

  } catch (error) {
    logger.error('Error getting customer orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get customer orders'
    });
  }
});

// Get material statistics for order
router.get('/:orderNumber/materials/stats', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const stats = await orderService.getMaterialStatistics(orderNumber);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting material statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get material statistics'
    });
  }
});

// Bulk approve approvals
router.post('/:orderNumber/bulk-approve', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { approvalIds, approvedBy, comments } = req.body;

    if (!approvalIds || !Array.isArray(approvalIds) || approvalIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'approvalIds array is required'
      });
    }

    if (!approvedBy) {
      return res.status(400).json({
        success: false,
        error: 'approvedBy is required'
      });
    }

    const result = await orderService.bulkApprove(
      orderNumber,
      approvalIds,
      approvedBy,
      comments
    );

    res.json({
      success: true,
      message: `Bulk approval completed: ${result.success} successful, ${result.failed} failed`,
      data: result
    });

  } catch (error) {
    logger.error('Error bulk approving:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk approve'
    });
  }
});

// Bulk reject approvals
router.post('/:orderNumber/bulk-reject', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { approvalIds, rejectedBy, rejectedReason, comments } = req.body;

    if (!approvalIds || !Array.isArray(approvalIds) || approvalIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'approvalIds array is required'
      });
    }

    if (!rejectedBy) {
      return res.status(400).json({
        success: false,
        error: 'rejectedBy is required'
      });
    }

    if (!rejectedReason) {
      return res.status(400).json({
        success: false,
        error: 'rejectedReason is required'
      });
    }

    const result = await orderService.bulkReject(
      orderNumber,
      approvalIds,
      rejectedBy,
      rejectedReason,
      comments
    );

    res.json({
      success: true,
      message: `Bulk rejection completed: ${result.success} successful, ${result.failed} failed`,
      data: result
    });

  } catch (error) {
    logger.error('Error bulk rejecting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk reject'
    });
  }
});

// Search orders with filters
router.get('/search', async (req, res) => {
  try {
    const {
      customerEmail,
      status,
      orderNumber,
      dateFrom,
      dateTo,
      limit = '50',
      offset = '0'
    } = req.query;

    const filters: any = {};

    if (customerEmail) filters.customerEmail = customerEmail as string;
    if (status) filters.status = status as string;
    if (orderNumber) filters.orderNumber = orderNumber as string;
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);

    const result = await orderService.searchOrders(
      filters,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: result.orders,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: result.total > (parseInt(offset as string) + parseInt(limit as string))
      }
    });

  } catch (error) {
    logger.error('Error searching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search orders'
    });
  }
});

// Update order status manually (admin endpoint)
router.put('/:orderNumber/status', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    await orderService.updateOrderStatus(orderNumber);

    const collection = await orderService.getOrderCollection(orderNumber);

    res.json({
      success: true,
      message: 'Order status updated',
      data: collection?.order
    });

  } catch (error) {
    logger.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status'
    });
  }
});

// Delete order and all associated approvals (admin endpoint)
router.delete('/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    await orderService.deleteOrder(orderNumber);

    res.json({
      success: true,
      message: `Order ${orderNumber} and all associated approvals deleted`
    });

  } catch (error) {
    logger.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete order'
    });
  }
});

export default router;