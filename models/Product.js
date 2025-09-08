const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    default: function() {
      return this.price;
    }
  },
  // Add discountPrice for better compatibility with your routes
  discountPrice: {
    type: Number,
    validate: {
      validator: function(v) {
        return v == null || v <= this.price;
      },
      message: 'Discount price cannot be higher than regular price'
    }
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  subcategory: {
    type: String,
    required: true
  },
  images: [{
    type: String,
    required: true
  }],
  // Rename for consistency with your routes
  inStock: {
    type: Boolean,
    default: true
  },
  // Change field name to match your routes (stock instead of stockQuantity)
  stock: {
    type: Number,
    default: 0,
    min: 0,
    alias: 'stockQuantity' // Keep backward compatibility
  },
  brand: {
    type: String,
    required: true
  },
  weight: {
    type: String,
    default: ''
  },
  origin: {
    type: String,
    default: 'India'
  },
  tags: [{
    type: String
  }],
  featured: {
    type: Boolean,
    default: false
  },
  bestseller: {
    type: Boolean,
    default: false
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  // Add fields for your Header.jsx bulk discount calculations
  discountAmount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Calculate discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.originalPrice > this.price) {
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  return 0;
});

// Add virtual for effective price (discountPrice or regular price)
productSchema.virtual('effectivePrice').get(function() {
  return this.discountPrice || this.price;
});

// Pre-save middleware to calculate discountAmount
productSchema.pre('save', function(next) {
  if (this.originalPrice && this.price < this.originalPrice) {
    this.discountAmount = this.originalPrice - this.price;
  } else {
    this.discountAmount = 0;
  }
  
  // Auto-calculate discountPrice if discount percentage is set
  if (this.discount > 0 && !this.discountPrice) {
    this.discountPrice = this.price - (this.price * this.discount / 100);
  }
  
  // Update inStock based on stock quantity
  this.inStock = this.stock > 0;
  
  next();
});

// Instance method to check if product has sufficient stock
productSchema.methods.hasStock = function(quantity = 1) {
  return this.stock >= quantity && this.inStock;
};

// Instance method to reduce stock
productSchema.methods.reduceStock = function(quantity) {
  if (this.hasStock(quantity)) {
    this.stock -= quantity;
    this.inStock = this.stock > 0;
    return this.save();
  }
  throw new Error('Insufficient stock');
};

// Instance method to add stock
productSchema.methods.addStock = function(quantity) {
  this.stock += quantity;
  this.inStock = true;
  return this.save();
};

// Static method to find products by category
productSchema.statics.findByCategory = function(categoryId) {
  return this.find({ category: categoryId, inStock: true });
};

// Static method to find featured products
productSchema.statics.findFeatured = function() {
  return this.find({ featured: true, inStock: true });
};

// Static method to find bestsellers
productSchema.statics.findBestsellers = function() {
  return this.find({ bestseller: true, inStock: true });
};

// Ensure virtual fields are serialized
productSchema.set('toJSON', {
  virtuals: true
});

// Add index for better performance
productSchema.index({ category: 1, inStock: 1 });
productSchema.index({ featured: 1, inStock: 1 });
productSchema.index({ bestseller: 1, inStock: 1 });
productSchema.index({ name: 'text', description: 'text' }); // For search functionality

module.exports = mongoose.model('Product', productSchema);
