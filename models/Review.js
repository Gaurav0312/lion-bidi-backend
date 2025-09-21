// models/Review.js - String-based version with fixed validation

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: [true, 'Product ID is required'],
    index: true,
    trim: true
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true,
    trim: true
  },
  userName: {
    type: String,
    required: [true, 'User name is required'],
    trim: true,
    maxLength: [100, 'User name cannot exceed 100 characters']
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
    trim: true
    // Removed strict URL validation that was causing the error
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
    maxLength: [100, 'Title cannot exceed 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    trim: true,
    maxLength: [1000, 'Comment cannot exceed 1000 characters']
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  },
  helpfulVotes: {
    type: Number,
    default: 0,
    min: [0, 'Helpful votes cannot be negative']
  },
  helpfulBy: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'spam'],
    default: 'approved'
  },
  images: [{
    type: String
    // Removed strict validation for images too
  }]
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, status: 1 });
reviewSchema.index({ createdAt: -1 });

// Virtual for user avatar
reviewSchema.virtual('userAvatar').get(function() {
  if (this.userProfileImage) {
    return this.userProfileImage;
  }
  const encodedName = encodeURIComponent(this.userName || 'User');
  return `https://ui-avatars.com/api/?name=${encodedName}&background=ff6b35&color=fff&size=100`;
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
