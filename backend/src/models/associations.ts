import { Order } from './Order.model';
import { Approval } from './Approval.model';

// Define associations between models
export function setupAssociations() {
  // Order has many Approvals
  Order.hasMany(Approval, {
    foreignKey: 'orderId',
    as: 'approvals'
  });

  // Approval belongs to Order
  Approval.belongsTo(Order, {
    foreignKey: 'orderId',
    as: 'order'
  });
}

export { Order, Approval };