// models/Review.js - String-based version
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: [true, 'Product ID is required'],
    index: true,
    trim: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Product ID cannot be empty'
    }
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true,
    trim: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'User ID cannot be empty'
    }
  },
  // Store user data directly in review document for better performance
  userName: {
    type: String,
    required: [true, 'User name is required'],
    trim: true,
    maxLength: [100, 'User name cannot exceed 100 characters'],
    minLength: [1, 'User name cannot be empty']
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
        if (!v) return true;
        return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(v);
      },
      message: 'Profile image must be a valid URL'
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
    maxLength: [100, 'Title cannot exceed 100 characters'],
    minLength: [3, 'Title must be at least 3 characters']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    trim: true,
    maxLength: [1000, 'Comment cannot exceed 1000 characters'],
    minLength: [10, 'Comment must be at least 10 characters']
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: false,
    index: true
  },
  helpfulVotes: {
    type: Number,
    default: 0,
    min: [0, 'Helpful votes cannot be negative']
  },
  helpfulBy: [{
    type: String // Store user IDs as strings
  }],
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected', 'spam'],
      message: 'Status must be pending, approved, rejected, or spam'
    },
    default: 'approved',
    index: true
  },
  images: [{
    type: String,
    validate: {
      validator: function(v) {
        // Allow base64 images or valid URLs
        return v.startsWith('data:image/') || v.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i);
      },
      message: 'Invalid image format'
    }
  }],
  // Additional metadata fields
  reportCount: {
    type: Number,
    default: 0,
    min: [0, 'Report count cannot be negative']
  },
  reportedBy: [{
    userId: {
      type: String // String instead of ObjectId
    },
    reason: {
      type: String,
      enum: ['inappropriate', 'spam', 'fake', 'offensive', 'other']
    },
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  moderatorNotes: {
    type: String,
    maxLength: [500, 'Moderator notes cannot exceed 500 characters']
  },
  moderatedBy: {
    type: String // String instead of ObjectId
  },
  moderatedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      delete ret.reportedBy;
      delete ret.moderatorNotes;
      delete ret.moderatedBy;
      delete ret.moderatedAt;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Compound indexes for better query performance
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, status: 1 });
reviewSchema.index({ userId: 1, status: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ rating: 1, productId: 1 });
reviewSchema.index({ helpfulVotes: -1 });

// Virtual for user avatar with Lion Bidi branding
reviewSchema.virtual('userAvatar').get(function() {
  if (this.userProfileImage) {
    return this.userProfileImage;
  }
  
  const encodedName = encodeURIComponent(this.userName || 'User');
  return `https://ui-avatars.com/api/?name=${encodedName}&background=ff6b35&color=fff&size=100&rounded=true`;
});

// Virtual for calculating days since review
reviewSchema.virtual('daysAgo').get(function() {
  const now = new Date();
  const reviewDate = this.createdAt;
  const diffTime = Math.abs(now - reviewDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
});

// Virtual for checking if review is recent (within 30 days)
reviewSchema.virtual('isRecent').get(function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return this.createdAt > thirtyDaysAgo;
});

// Static methods adapted for string IDs
reviewSchema.statics.getProductRatingStats = async function(productId) {
  const stats = await this.aggregate([
    { 
      $match: { 
        productId: productId, // Direct string comparison
        status: 'approved'
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (!stats.length) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: []
    };
  }

  const result = stats[0];
  
  // Calculate rating distribution
  const distribution = [5, 4, 3, 2, 1].map(rating => ({
    _id: rating,
    count: result.ratingDistribution.filter(r => r === rating).length
  }));

  return {
    averageRating: Math.round(result.averageRating * 10) / 10,
    totalReviews: result.totalReviews,
    ratingDistribution: distribution
  };
};

reviewSchema.statics.getUserReviewForProduct = async function(userId, productId) {
  return await this.findOne({
    userId: userId, // Direct string comparison
    productId: productId
  });
};

reviewSchema.statics.getMostHelpfulReviews = async function(productId, limit = 5) {
  return await this.find({
    productId: productId, // Direct string comparison
    status: 'approved'
  })
  .sort({ helpfulVotes: -1, createdAt: -1 })
  .limit(limit);
};

// Instance methods adapted for string IDs
reviewSchema.methods.toggleHelpfulVote = async function(userId) {
  const hasVoted = this.helpfulBy.includes(userId);
  
  if (hasVoted) {
    this.helpfulBy.pull(userId);
    this.helpfulVotes = Math.max(0, this.helpfulVotes - 1);
  } else {
    this.helpfulBy.addToSet(userId);
    this.helpfulVotes += 1;
  }
  
  await this.save();
  return !hasVoted; // Return new vote status
};

reviewSchema.methods.addReport = async function(userId, reason) {
  this.reportedBy.push({
    userId: userId, // Direct string assignment
    reason: reason,
    reportedAt: new Date()
  });
  this.reportCount += 1;
  
  // Auto-hide if too many reports
  if (this.reportCount >= 5) {
    this.status = 'pending';
  }
  
  await this.save();
};

// Pre-save middleware
reviewSchema.pre('save', function(next) {
  // Ensure helpfulVotes doesn't go negative
  if (this.helpfulVotes < 0) {
    this.helpfulVotes = 0;
  }
  
  // Set moderation timestamp when status changes
  if (this.isModified('status') && this.status !== 'pending') {
    this.moderatedAt = new Date();
  }
  
  // Sanitize user data
  if (this.userName) {
    this.userName = this.userName.trim().replace(/\s+/g, ' ');
  }
  
  if (this.userEmail) {
    this.userEmail = this.userEmail.toLowerCase().trim();
  }
  
  next();
});

// Pre-remove middleware
reviewSchema.pre('remove', async function(next) {
  // Cleanup logic if needed
  next();
});

// Post-save middleware for updating product statistics
reviewSchema.post('save', async function(doc, next) {
  // Trigger product rating recalculation if needed
  next();
});

// Add text index for search functionality
reviewSchema.index({
  title: 'text',
  comment: 'text',
  userName: 'text'
}, {
  weights: {
    title: 10,
    comment: 5,
    userName: 1
  }
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
