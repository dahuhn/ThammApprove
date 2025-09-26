import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Create Orders table
  await queryInterface.createTable('orders', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    customerEmail: {
      type: DataTypes.STRING,
      allowNull: false
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
      defaultValue: 60
    },
    status: {
      type: DataTypes.ENUM('pending', 'partial', 'completed', 'cancelled'),
      defaultValue: 'pending',
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  });

  // Add indexes to orders table
  await queryInterface.addIndex('orders', ['orderNumber'], { unique: true });
  await queryInterface.addIndex('orders', ['customerEmail']);
  await queryInterface.addIndex('orders', ['status']);
  await queryInterface.addIndex('orders', ['lastEmailSent']);

  // Add new columns to approvals table
  await queryInterface.addColumn('approvals', 'orderNumber', {
    type: DataTypes.STRING,
    allowNull: true
  });

  await queryInterface.addColumn('approvals', 'orderId', {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'orders',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  });

  await queryInterface.addColumn('approvals', 'material', {
    type: DataTypes.STRING,
    allowNull: true
  });

  await queryInterface.addColumn('approvals', 'positionNumber', {
    type: DataTypes.INTEGER,
    allowNull: true
  });

  await queryInterface.addColumn('approvals', 'rejectedBy', {
    type: DataTypes.STRING,
    allowNull: true
  });

  await queryInterface.addColumn('approvals', 'rejectedAt', {
    type: DataTypes.DATE,
    allowNull: true
  });

  // Add indexes to approvals table for new columns
  await queryInterface.addIndex('approvals', ['orderNumber']);
  await queryInterface.addIndex('approvals', ['orderId']);
  await queryInterface.addIndex('approvals', ['material']);
  await queryInterface.addIndex('approvals', ['positionNumber']);
  await queryInterface.addIndex('approvals', ['orderNumber', 'positionNumber']);
  await queryInterface.addIndex('approvals', ['orderNumber', 'material']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  // Remove indexes from approvals
  await queryInterface.removeIndex('approvals', ['orderNumber', 'material']);
  await queryInterface.removeIndex('approvals', ['orderNumber', 'positionNumber']);
  await queryInterface.removeIndex('approvals', ['positionNumber']);
  await queryInterface.removeIndex('approvals', ['material']);
  await queryInterface.removeIndex('approvals', ['orderId']);
  await queryInterface.removeIndex('approvals', ['orderNumber']);

  // Remove new columns from approvals
  await queryInterface.removeColumn('approvals', 'rejectedAt');
  await queryInterface.removeColumn('approvals', 'rejectedBy');
  await queryInterface.removeColumn('approvals', 'positionNumber');
  await queryInterface.removeColumn('approvals', 'material');
  await queryInterface.removeColumn('approvals', 'orderId');
  await queryInterface.removeColumn('approvals', 'orderNumber');

  // Drop orders table
  await queryInterface.dropTable('orders');
}