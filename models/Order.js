// models/Order.js - Updated with fixes for order creation issues
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.Mixed, // Can handle both ObjectId and string/number IDs
    required: false // Made optional since some products might be deleted
  },
  name: { type: String, required: true, trim: true },
  price: { 
    type: Number, 
    required: true,
    min: [0, 'Price cannot be negative']
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: [1, 'Quantity must be at least 1']
  },
  image: { type: String, required: false }, // Made optional since some products might not have images
  totalPrice: { 
    type: Number, 
    required: true,
    min: [0, 'Total price cannot be negative']
  }
});

const shippingAddressSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  phone: { 
    type: String, 
    required: true, 
    trim: true,
    validate: {
      validator: function(v) {
        // Allow various phone number formats
        return /^[6-9]\d{9}$/.test(v.replace(/\D/g, ''));
      },
      message: 'Please enter a valid phone number'
    }
  },
  email: { 
    type: String, 
    required: true, 
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  street: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: [500, 'Street address cannot exceed 500 characters']
  },
  city: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: [100, 'City name cannot exceed 100 characters']
  },
  state: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: [100, 'State name cannot exceed 100 characters']
  },
  zipCode: { 
    type: String, 
    required: true, 
    trim: true,
    validate: {
      validator: function(v) {
        // Allow various PIN code formats
        const cleaned = v.replace(/\D/g, '');
        return /^\d{6}$/.test(cleaned);
      },
      message: 'Please enter a valid 6-digit PIN code'
    }
  },
  country: { type: String, default: 'India', trim: true }
});

// Enhanced payment schema with better error handling
const paymentInfoSchema = new mongoose.Schema({
  method: { type: String, enum: ['UPI', 'Card', 'Cash'], default: 'UPI' },
  
  paymentStatus: { 
    type: String, 
    enum: [
      'pending',
      'pending_verification',
      'verified',
      'verification_failed',
      'completed',
      'failed',
      'refunded'
    ], 
    default: 'pending' 
  },
  
  transactionId: { 
    type: String,
    uppercase: true,
    trim: true,
    default: null
  },
  
  submittedAt: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  paymentDate: { type: Date, default: null },
  
  amount: { 
    type: Number, 
    required: true,
    min: [0, 'Payment amount cannot be negative']
  },
  upiId: { type: String, trim: true, default: null },
  
  screenshot: { type: String, default: null },
  verificationNotes: { type: String, trim: true, default: '' },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
  suspicionFlags: { type: [String], default: [] }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  items: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Order must contain at least one item'
    }
  },
  
  subtotal: { 
    type: Number, 
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  discount: { 
    type: Number, 
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  shipping: { 
    type: Number, 
    default: 0,
    min: [0, 'Shipping cost cannot be negative']
  },
  tax: { 
    type: Number, 
    default: 0,
    min: [0, 'Tax cannot be negative']
  },
  total: { 
    type: Number, 
    required: true,
    min: [0.01, 'Total must be greater than 0']
  },
  
  shippingAddress: {
    type: shippingAddressSchema,
    required: true
  },
  
  payment: {
    type: paymentInfoSchema,
    required: true
  },
  
  status: {
    type: String,
    enum: [
      'pending',
      'payment_submitted',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'returned',
      'payment_failed'
    ],
    default: 'pending',
    index: true
  },
  
  orderDate: { type: Date, default: Date.now, index: true },
  confirmedAt: { type: Date, default: null },
  shippedAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  
  trackingNumber: { type: String, default: null },
  
  notes: { type: String, default: '', maxlength: [1000, 'Notes cannot exceed 1000 characters'] },
  adminNotes: { type: String, default: '', maxlength: [1000, 'Admin notes cannot exceed 1000 characters'] },
  
  cancellationReason: { type: String, default: null },
  returnReason: { type: String, default: null }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Enhanced pre-save middleware with better error handling
orderSchema.pre('save', async function(next) {
  try {
    if (this.isNew && !this.orderNumber) {
      // Generate unique order number with retry mechanism
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        try {
          const timestamp = Date.now();
          const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          const orderNumber = `ORD${timestamp}${random}`;
          
          // Check if this order number already exists
          const existingOrder = await this.constructor.findOne({ orderNumber });
          if (!existingOrder) {
            this.orderNumber = orderNumber;
            break;
          }
          attempts++;
        } catch (error) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error('Failed to generate unique order number');
          }
        }
      }
    }
    
    // Validate payment amount matches total
    if (this.payment && Math.abs(this.payment.amount - this.total) > 0.01) {
      this.payment.amount = this.total;
    }
    
    // Validate item total prices
    this.items.forEach((item, index) => {
      const calculatedTotal = item.price * item.quantity;
      if (Math.abs(item.totalPrice - calculatedTotal) > 0.01) {
        this.items[index].totalPrice = calculatedTotal;
      }
    });
    
    next();
  } catch (error) {
    next(error);
  }
});

// Enhanced status update method
orderSchema.methods.updateStatus = function(newStatus, additionalData = {}) {
  this.status = newStatus;
  
  switch(newStatus) {
    case 'payment_submitted':
      if (additionalData.paymentInfo) {
        this.payment.paymentStatus = 'pending_verification';
        this.payment.submittedAt = new Date();
        this.payment.transactionId = additionalData.paymentInfo.transactionId;
        this.payment.screenshot = additionalData.paymentInfo.screenshot;
        this.payment.upiId = additionalData.paymentInfo.upiId;
        this.payment.ipAddress = additionalData.paymentInfo.ipAddress;
        this.payment.userAgent = additionalData.paymentInfo.userAgent;
      }
      break;
      
    case 'confirmed':
      this.confirmedAt = new Date();
      if (additionalData.paymentInfo) {
        this.payment.paymentStatus = 'verified';
        this.payment.verifiedAt = new Date();
        this.payment.paymentDate = additionalData.paymentInfo.paymentDate || new Date();
        this.payment.verificationNotes = additionalData.paymentInfo.notes || '';
        this.payment.verifiedBy = additionalData.paymentInfo.verifiedBy;
      }
      break;
      
    case 'payment_failed':
      if (additionalData.paymentInfo) {
        this.payment.paymentStatus = 'verification_failed';
        this.payment.verificationNotes = additionalData.paymentInfo.notes || '';
        this.payment.verifiedBy = additionalData.paymentInfo.verifiedBy;
      }
      break;
      
    case 'shipped':
      this.shippedAt = new Date();
      if (additionalData.trackingNumber) {
        this.trackingNumber = additionalData.trackingNumber;
      }
      break;
      
    case 'delivered':
      this.deliveredAt = new Date();
      break;
  }
  
  return this.save();
};

// Method to submit payment for verification
orderSchema.methods.submitPaymentForVerification = function(paymentData) {
  return this.updateStatus('payment_submitted', {
    paymentInfo: {
      transactionId: paymentData.transactionId,
      screenshot: paymentData.screenshot,
      upiId: paymentData.upiId,
      ipAddress: paymentData.ipAddress,
      userAgent: paymentData.userAgent
    }
  });
};

// Method to verify payment (admin action)
orderSchema.methods.verifyPayment = function(verified, adminData = {}) {
  const newStatus = verified ? 'confirmed' : 'payment_failed';
  return this.updateStatus(newStatus, {
    paymentInfo: {
      notes: adminData.notes || '',
      verifiedBy: adminData.adminId,
      paymentDate: adminData.paymentDate
    }
  });
};

// Check if transaction ID is already used
orderSchema.statics.isTransactionIdUsed = async function(transactionId, excludeOrderId = null) {
  if (!transactionId) return false;
  
  const cleanTransactionId = transactionId.toString().toUpperCase().trim();
  if (!cleanTransactionId) return false;
  
  const query = { 
    'payment.transactionId': cleanTransactionId,
    'payment.paymentStatus': { $in: ['pending_verification', 'verified', 'completed'] }
  };
  
  if (excludeOrderId) {
    query._id = { $ne: excludeOrderId };
  }
  
  try {
    const existingOrder = await this.findOne(query);
    return !!existingOrder;
  } catch (error) {
    console.error('Error checking transaction ID:', error);
    return false;
  }
};

// Find orders pending payment verification
orderSchema.statics.findPendingVerifications = function(options = {}) {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ 
    'payment.paymentStatus': 'pending_verification' 
  })
  .populate('userId', 'name email')
  .sort({ 'payment.submittedAt': -1 })
  .skip(skip)
  .limit(limit);
};

// Get order summary for user
orderSchema.methods.getOrderSummary = function() {
  return {
    _id: this._id,
    orderNumber: this.orderNumber,
    orderDate: this.orderDate,
    status: this.status,
    total: this.total,
    subtotal: this.subtotal,
    discount: this.discount,
    itemCount: this.items.length,
    paymentStatus: this.payment?.paymentStatus || 'pending',
    items: this.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      image: item.image,
      totalPrice: item.totalPrice
    })),
    shippingAddress: this.shippingAddress
  };
};

// Static method to find orders by user
orderSchema.statics.findByUser = function(userId, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Enhanced validation for transaction ID format
orderSchema.path('payment.transactionId').validate(function(value) {
  if (!value) return true; // Allow empty (will be set when submitted)
  
  const cleanValue = value.toString().toUpperCase().trim();
  if (cleanValue.length < 10 || cleanValue.length > 20) {
    return false;
  }
  
  // UPI Transaction ID validation patterns
  const upiPatterns = [
    /^\d{12}$/,                    // 12 digits
    /^[A-Z0-9]{12}$/,             // 12 alphanumeric
    /^\d{10,16}$/,                // 10-16 digits
    /^[A-Z0-9]{10,16}$/,          // 10-16 alphanumeric
    /^[A-Z]{2,4}\d{10,14}$/,      // 2-4 letters followed by 10-14 digits
  ];
  
  return upiPatterns.some(pattern => pattern.test(cleanValue));
}, 'Invalid UPI transaction ID format');

// Enhanced indexes for better performance
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ status: 1 });
orderSchema.index({ 'payment.paymentStatus': 1 });
orderSchema.index({ 'payment.transactionId': 1 });
orderSchema.index({ 'payment.submittedAt': -1 });
orderSchema.index({ orderDate: -1 });

// Error handling middleware
orderSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' && error.code === 11000) {
    if (error.message.includes('orderNumber')) {
      next(new Error('Order number already exists. Please try again.'));
    } else {
      next(new Error('Duplicate entry detected. Please try again.'));
    }
  } else {
    next(error);
  }
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;