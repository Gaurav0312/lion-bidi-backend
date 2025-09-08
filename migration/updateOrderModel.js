// migration/updateOrderModel.js - Script to migrate existing orders
const mongoose = require('mongoose');
const Order = require('../models/Order');

async function migrateOrders() {
  try {
    console.log('Starting order migration...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');
    
    // Find all existing orders
    const existingOrders = await Order.find({});
    console.log(`Found ${existingOrders.length} orders to migrate`);
    
    let migrated = 0;
    
    for (const order of existingOrders) {
      let needsUpdate = false;
      const updates = {};
      
      // Update payment status if it's the old 'completed' status
      if (order.payment?.paymentStatus === 'completed') {
        updates['payment.paymentStatus'] = 'verified';
        updates['payment.verifiedAt'] = order.payment.paymentDate || order.confirmedAt || order.createdAt;
        needsUpdate = true;
      }
      
      // Ensure transaction IDs are uppercase
      if (order.payment?.transactionId && 
          order.payment.transactionId !== order.payment.transactionId.toUpperCase()) {
        updates['payment.transactionId'] = order.payment.transactionId.toUpperCase().trim();
        needsUpdate = true;
      }
      
      // Update order status mapping
      if (order.status === 'pending' && order.payment?.paymentStatus === 'completed') {
        updates['status'] = 'confirmed';
        needsUpdate = true;
      }
      
      // Add missing payment amount if not present
      if (order.payment && !order.payment.amount) {
        updates['payment.amount'] = order.total;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await Order.findByIdAndUpdate(order._id, { $set: updates });
        migrated++;
        console.log(`Migrated order ${order.orderNumber}`);
      }
    }
    
    console.log(`Migration completed: ${migrated} orders updated`);
    
    // Create indexes if they don't exist
    await Order.collection.createIndex({ 'payment.transactionId': 1 });
    await Order.collection.createIndex({ 'payment.submittedAt': -1 });
    console.log('Indexes created successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

// Run migration
if (require.main === module) {
  migrateOrders();
}

module.exports = migrateOrders;