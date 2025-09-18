// models/Review.js - Enhanced and optimized version
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: [true, 'Product ID is required'],
    index: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9_-]+$/.test(v);
      },
      message: 'Product ID contains invalid characters'
    }
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Allow ObjectId format or custom user ID format
        return mongoose.Types.ObjectId.isValid(v) || /^[a-zA-Z0-9_-]+$/.test(v);
      },
      message: 'Invalid user ID format'
    }
  },
  userName: {
    type: String,
    required: [true, 'User name is required'],
    trim: true,
    minlength: [1, 'User name cannot be empty'],
    maxlength: [100, 'User name cannot exceed 100 characters'],
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9\s._-]+$/.test(v);
      },
      message: 'User name contains invalid characters'
    }
  },
  userEmail: {
    type: String,
    required: [true, 'User email is required'],
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  userProfileImage: {
    type: String,
    default: null,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow null/empty values
        return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(v);
      },
      message: 'Profile image must be a valid URL with image extension'
    }
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    validate: {
      validator: Number.isInteger,
      message: 'Rating must be a whole number'
    }
  },
  title: {
    type: String,
    required: [true, 'Review title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters long'],
    maxlength: [200, 'Title cannot exceed 200 characters'],
    validate: {
      validator: function(v) {
        return v && v.trim().length >= 5;
      },
      message: 'Title must contain meaningful content'
    }
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    trim: true,
    minlength: [10, 'Comment must be at least 10 characters long'],
    maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    validate: {
      validator: function(v) {
        return v && v.trim().length >= 10;
      },
      message: 'Comment must contain meaningful content'
    }
  },
  images: {
    type: [String],
    default: [],
    validate: [
      {
        validator: function(v) {
          return v.length <= 5;
        },
        message: 'Cannot upload more than 5 images'
      },
      {
        validator: function(images) {
          if (!images || images.length === 0) return true;
          return images.every(url => 
            /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)
          );
        },
        message: 'All images must be valid URLs with image extensions'
      }
    ]
  },
  helpfulVotes: {
    type: Number,
    default: 0,
    min: [0, 'Helpful votes cannot be negative'],
    index: true // For sorting by most helpful
  },
  helpfulBy: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        return v.length <= 1000; // Reasonable limit
      },
      message: 'Too many helpful votes recorded'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected', 'spam'],
      message: 'Status must be: pending, approved, rejected, or spam'
    },
    default: 'approved',
    index: true
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: false,
    index: true // For filtering verified reviews
  },
  flagCount: {
    type: Number,
    default: 0,
    min: [0, 'Flag count cannot be negative'],
    max: [100, 'Flag count seems unusually high']
  },
  flaggedBy: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        return v.length <= 50; // Reasonable limit
      },
      message: 'Too many flag reports'
    }
  },
  // Enhanced fields for better functionality
  reviewSource: {
    type: String,
    enum: ['web', 'mobile', 'api'],
    default: 'web'
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  moderatorNotes: {
    type: String,
    maxlength: [500, 'Moderator notes cannot exceed 500 characters'],
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive fields from JSON output
      delete ret.flaggedBy;
      delete ret.moderatorNotes;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Compound indexes for optimal query performance
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ productId: 1, rating: -1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });
reviewSchema.index({ productId: 1, helpfulVotes: -1 }); // Most helpful first
reviewSchema.index({ productId: 1, isVerifiedPurchase: 1, createdAt: -1 }); // Verified reviews

// Enhanced virtual for user avatar with Lion Bidi branding
reviewSchema.virtual('userAvatar').get(function() {
  if (this.userProfileImage) {
    return this.userProfileImage;
  }
  
  const encodedName = encodeURIComponent(this.userName || 'User');
  return `https://ui-avatars.com/api/?name=${encodedName}&background=ff6b35&color=fff&size=100&rounded=true`;
});

// Virtual for review age
reviewSchema.virtual('reviewAge').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
});

// Virtual for helpful percentage
reviewSchema.virtual('helpfulPercentage').get(function() {
  if (!this.helpfulBy || this.helpfulBy.length === 0) return 0;
  return Math.round((this.helpfulVotes / this.helpfulBy.length) * 100);
});

// Enhanced pre-save middleware with comprehensive sanitization
reviewSchema.pre('save', function(next) {
  // Sanitize string fields
  if (this.title) {
    this.title = this.title.trim().replace(/\s+/g, ' ');
  }
  
  if (this.comment) {
    this.comment = this.comment.trim().replace(/\s+/g, ' ');
  }
  
  if (this.userName) {
    this.userName = this.userName.trim().replace(/\s+/g, ' ');
  }
  
  if (this.userEmail) {
    this.userEmail = this.userEmail.toLowerCase().trim();
  }
  
  // Update lastModified timestamp
  this.lastModified = new Date();
  
  // Auto-flag for moderation if needed
  if (this.flagCount >= 5 && this.status === 'approved') {
    this.status = 'pending';
  }
  
  next();
});

// Pre-update middleware
reviewSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
  this.set({ lastModified: new Date() });
  next();
});

// Static methods for common queries
reviewSchema.statics.getProductReviews = function(productId, options = {}) {
  const { 
    status = 'approved', 
    limit = 10, 
    skip = 0, 
    sortBy = 'createdAt',
    sortOrder = -1 
  } = options;
  
  return this.find({ 
    productId: productId, 
    status: status 
  })
  .sort({ [sortBy]: sortOrder })
  .limit(limit)
  .skip(skip);
};

reviewSchema.statics.getProductStats = function(productId) {
  return this.aggregate([
    { $match: { productId: productId, status: 'approved' } },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        verifiedReviews: {
          $sum: { $cond: ['$isVerifiedPurchase', 1, 0] }
        },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);
};

// Instance methods
reviewSchema.methods.markAsHelpful = function(userId) {
  if (!this.helpfulBy.includes(userId)) {
    this.helpfulBy.push(userId);
    this.helpfulVotes += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

reviewSchema.methods.removeHelpful = function(userId) {
  const index = this.helpfulBy.indexOf(userId);
  if (index > -1) {
    this.helpfulBy.splice(index, 1);
    this.helpfulVotes = Math.max(0, this.helpfulVotes - 1);
    return this.save();
  }
  return Promise.resolve(this);
};

// Add text search index for search functionality
reviewSchema.index({
  title: 'text',
  comment: 'text',
  userName: 'text'
}, {
  weights: {
    title: 10,
    comment: 5,
    userName: 1
  },
  name: 'review_text_index'
});

console.log('📋 Enhanced Review model configured with optimizations');

module.exports = mongoose.model('Review', reviewSchema);
