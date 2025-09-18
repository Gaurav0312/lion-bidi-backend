// models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required'],
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected'],
      message: 'Status must be pending, approved, or rejected'
    },
    default: 'approved', // Change to 'pending' if you want manual moderation
    index: true
  },
  images: [{
    type: String, // Base64 encoded images or URLs
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
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: {
    type: Date
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive fields from JSON output
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
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true }); // Prevent duplicate reviews
reviewSchema.index({ productId: 1, status: 1 }); // For fetching approved reviews by product
reviewSchema.index({ userId: 1, status: 1 }); // For fetching user's reviews
reviewSchema.index({ createdAt: -1 }); // For sorting by date
reviewSchema.index({ rating: 1, productId: 1 }); // For rating distribution queries
reviewSchema.index({ helpfulVotes: -1 }); // For sorting by helpfulness

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

// Static methods for common queries
reviewSchema.statics.getProductRatingStats = async function(productId) {
  const stats = await this.aggregate([
    { 
      $match: { 
        productId: new mongoose.Types.ObjectId(productId),
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
    userId: new mongoose.Types.ObjectId(userId),
    productId: new mongoose.Types.ObjectId(productId)
  });
};

reviewSchema.statics.getMostHelpfulReviews = async function(productId, limit = 5) {
  return await this.find({
    productId: new mongoose.Types.ObjectId(productId),
    status: 'approved'
  })
  .populate('userId', 'name email profileImage')
  .sort({ helpfulVotes: -1, createdAt: -1 })
  .limit(limit);
};

// Instance methods
reviewSchema.methods.toggleHelpfulVote = async function(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const hasVoted = this.helpfulBy.includes(userObjectId);
  
  if (hasVoted) {
    this.helpfulBy.pull(userObjectId);
    this.helpfulVotes = Math.max(0, this.helpfulVotes - 1);
  } else {
    this.helpfulBy.addToSet(userObjectId);
    this.helpfulVotes += 1;
  }
  
  await this.save();
  return !hasVoted; // Return new vote status
};

reviewSchema.methods.addReport = async function(userId, reason) {
  this.reportedBy.push({
    userId: new mongoose.Types.ObjectId(userId),
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
  
  next();
});

// Pre-remove middleware to clean up related data
reviewSchema.pre('remove', async function(next) {
  // Could add cleanup logic here if needed
  // For example, updating product average rating
  next();
});

// Post-save middleware for updating product statistics
reviewSchema.post('save', async function(doc, next) {
  // You could trigger product rating recalculation here
  // Example: await Product.updateRatingStats(doc.productId);
  next();
});

// Add text index for search functionality
reviewSchema.index({
  title: 'text',
  comment: 'text'
}, {
  weights: {
    title: 10,
    comment: 5
  }
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;