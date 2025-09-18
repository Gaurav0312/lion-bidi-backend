// routes/reviews.js
const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const mongoose = require('mongoose');

// GET /api/reviews/product/:productId - This is what your frontend calls
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    console.log(`🔍 Fetching reviews for product: ${productId}`);
    
    // Convert productId to ObjectId if it's a valid ObjectId, otherwise use as string
    let query = { status: 'approved' };
    
    if (mongoose.Types.ObjectId.isValid(productId)) {
      query.productId = new mongoose.Types.ObjectId(productId);
    } else {
      // If not a valid ObjectId, treat as string (for compatibility)
      query.productId = productId;
    }

    const reviews = await Review.find(query).sort({ createdAt: -1 });
    
    // Calculate rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: query },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    console.log(`📊 Found ${reviews.length} reviews for product ${productId}`);
    
    res.json({
      success: true,
      reviews: reviews,
      totalReviews: reviews.length,
      ratingDistribution: ratingDistribution
    });
    
  } catch (error) {
    console.error('❌ Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: error.message,
      reviews: [],
      totalReviews: 0,
      ratingDistribution: []
    });
  }
});

// POST /api/reviews - This is what your frontend calls to create reviews
router.post('/', async (req, res) => {
  try {
    const { productId, rating, title, comment, images } = req.body;
    
    console.log('📝 Submitting review:', { productId, rating, title });
    
    // Validation
    if (!productId || !rating || !title || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: productId, rating, title, and comment are required'
      });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }
    
    // Create dummy user data (until you implement proper auth)
    const dummyUserId = 'user_' + Date.now();
    
    const newReview = new Review({
      productId: mongoose.Types.ObjectId.isValid(productId) 
        ? new mongoose.Types.ObjectId(productId) 
        : productId,
      userId: dummyUserId,
      rating: parseInt(rating),
      title: title.trim(),
      comment: comment.trim(),
      images: images || [],
      helpfulVotes: 0,
      helpfulBy: [],
      status: 'approved'
    });
    
    const savedReview = await newReview.save();
    
    console.log('✅ Review created successfully:', savedReview._id);
    
    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      review: {
        ...savedReview.toObject(),
        userId: {
          name: 'Anonymous User',
          email: 'user@example.com'
        },
        hasUserVoted: false
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating review:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating review',
      error: error.message
    });
  }
});

// POST /api/reviews/:reviewId/helpful - For voting on reviews
router.post('/:reviewId/helpful', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const dummyUserId = 'user_' + Date.now(); // Replace with actual user ID from auth
    
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    const hasVoted = review.helpfulBy.includes(dummyUserId);
    
    if (hasVoted) {
      // Remove vote
      review.helpfulBy.pull(dummyUserId);
      review.helpfulVotes = Math.max(0, review.helpfulVotes - 1);
    } else {
      // Add vote
      review.helpfulBy.push(dummyUserId);
      review.helpfulVotes += 1;
    }
    
    await review.save();
    
    res.json({
      success: true,
      helpfulVotes: review.helpfulVotes,
      hasVoted: !hasVoted
    });
    
  } catch (error) {
    console.error('❌ Error updating helpful vote:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating vote',
      error: error.message
    });
  }
});

console.log('📋 Reviews router configured with proper Express Router syntax');

module.exports = router;
