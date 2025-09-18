// models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: [true, 'Product ID is required'],
    index: true
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  userName: {
    type: String,
    required: [true, 'User name is required'],
    trim: true
  },
  userEmail: {
    type: String,
    required: [true, 'User email is required'],
    trim: true,
    lowercase: true
  },
  userProfileImage: {
    type: String,
    default: null,
    trim: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  title: {
    type: String,
    required: [true, 'Review title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    trim: true,
    maxlength: [2000, 'Comment cannot exceed 2000 characters']
  },
  images: {
    type: [String],
    validate: {
      validator: function(v) {
        return v.length <= 5;
      },
      message: 'Cannot upload more than 5 images'
    }
  },
  helpfulVotes: {
    type: Number,
    default: 0,
    min: 0
  },
  helpfulBy: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected'],
      message: 'Status must be pending, approved, or rejected'
    },
    default: 'approved'
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  },
  flagCount: {
    type: Number,
    default: 0,
    min: 0
  },
  flaggedBy: {
    type: [String],
    default: []
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });

// Virtual for user profile image with fallback
reviewSchema.virtual('userAvatar').get(function() {
  return this.userProfileImage || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userName)}&background=f97316&color=fff&size=100`;
});

// Pre-save middleware for data sanitization
reviewSchema.pre('save', function(next) {
  if (this.title) this.title = this.title.trim();
  if (this.comment) this.comment = this.comment.trim();
  if (this.userName) this.userName = this.userName.trim();
  if (this.userEmail) this.userEmail = this.userEmail.toLowerCase().trim();
  next();
});

module.exports = mongoose.model('Review', reviewSchema);
