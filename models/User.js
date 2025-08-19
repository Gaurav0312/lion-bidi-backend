// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Address Schema for multiple addresses
const addressSchema = new mongoose.Schema({
  street: {
    type: String,
    required: [true, 'Street is required']
  },
  city: {
    type: String,
    required: [true, 'City is required']
  },
  state: {
    type: String,
    required: [true, 'State is required']
  },
  zipCode: {
    type: String,
    required: [true, 'ZIP/Pin code is required']
  },
  country: {
    type: String,
    default: 'India'
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, { _id: true });

// Main User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  phone: {
    type: String,
    required: [true, 'Please add a phone number'],
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Please add a valid Indian phone number']
  },
  lastLogin: { type: Date }, 
  
  // Enhanced address handling - supports both single address (backward compatibility) and multiple addresses
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'India' }
  },
  addresses: [addressSchema], // Multiple addresses support
  
  dateOfBirth: {
    type: Date
  },
  
  // Role management - supports both isAdmin and role fields
  isAdmin: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['customer', 'admin'],
    default: 'customer'
  },
  
  // Profile enhancements
  avatar: {
    type: String,
    default: null
  },
  
  // E-commerce features
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  
  cart: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  
  // Verification and security features
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Token fields for password reset and email verification
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  emailVerificationToken: String,
  emailVerificationExpire: Date
}, {
  timestamps: true
});

// Pre-save middleware to sync isAdmin with role
userSchema.pre('save', async function(next) {
  // Sync isAdmin with role field
  if (this.isModified('isAdmin')) {
    this.role = this.isAdmin ? 'admin' : 'customer';
  } else if (this.isModified('role')) {
    this.isAdmin = this.role === 'admin';
  }
  
  // Hash password if modified
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// JWT token generation
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// Password comparison methods (supports both naming conventions)
userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Cart utility methods
userSchema.methods.getCartTotal = function() {
  if (!this.cart || this.cart.length === 0) return 0;
  
  return this.cart.reduce((total, item) => {
    // Handle case where product might be populated or just an ObjectId
    const price = item.product?.price || 0;
    return total + (item.quantity * price);
  }, 0);
};

userSchema.methods.getCartItemsCount = function() {
  if (!this.cart || this.cart.length === 0) return 0;
  
  return this.cart.reduce((total, item) => total + item.quantity, 0);
};

// Address utility methods
userSchema.methods.getDefaultAddress = function() {
  if (this.addresses && this.addresses.length > 0) {
    return this.addresses.find(addr => addr.isDefault) || this.addresses[0];
  }
  return this.address; // Fallback to single address field
};

userSchema.methods.addToCart = function(productId, quantity = 1) {
  const existingItem = this.cart.find(item => 
    item.product.toString() === productId.toString()
  );
  
  if (existingItem) {
    existingItem.quantity += quantity;
    existingItem.addedAt = new Date();
  } else {
    this.cart.push({
      product: productId,
      quantity: quantity,
      addedAt: new Date()
    });
  }
  
  return this.save();
};

userSchema.methods.removeFromCart = function(productId) {
  this.cart = this.cart.filter(item => 
    item.product.toString() !== productId.toString()
  );
  return this.save();
};

userSchema.methods.clearCart = function() {
  this.cart = [];
  return this.save();
};

// Wishlist utility methods
userSchema.methods.addToWishlist = function(productId) {
  if (!this.wishlist.includes(productId)) {
    this.wishlist.push(productId);
  }
  return this.save();
};

userSchema.methods.removeFromWishlist = function(productId) {
  this.wishlist = this.wishlist.filter(id => 
    id.toString() !== productId.toString()
  );
  return this.save();
};

// Virtual for full name (if you want to split name field later)
userSchema.virtual('fullName').get(function() {
  return this.name;
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', {
  virtuals: true
});

const User = mongoose.model('User', userSchema);

module.exports = User;