// models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: {
    type: String, // Changed from ObjectId to String
    required: true,
    index: true
  },
  userId: {
    type: String, // Also changed to String for consistency
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  comment: {
    type: String,
    required: true,
    trim: true
  },
  images: [String],
  helpfulVotes: {
    type: Number,
    default: 0
  },
  helpfulBy: [String], // Changed to String array
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Review', reviewSchema);
