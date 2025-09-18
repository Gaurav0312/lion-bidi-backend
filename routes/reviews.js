// routes/reviews.js - Enhanced version with all features
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Import your Review model
const Review = require('../models/Review');

// Enhanced authentication middleware
const getAuthenticatedUser = (req) => {
  // Check if user data is passed in the request body (for testing without JWT)
  if (req.body.currentUser && req.body.currentUser._id) {
    return {
      _id: req.body.currentUser._id,
      name: req.body.currentUser.name || 'Unknown User',
      email: req.body.currentUser.email || 'unknown@example.com',
      profileImage: req.body.currentUser.profileImage || req.body.currentUser.avatar || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(req.body.currentUser.name || 'User')}&background=f97316&color=fff&size=100`
    };
  }
  
  // Try to get from Authorization header (JWT)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      // You'll need to decode your JWT token here
      // For now, return null to use currentUser from request body
      return null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }
  
  return null;
};

// GET /api/reviews/product/:productId - Fetch reviews with full features
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`🔍 Fetching reviews for product: ${productId}`);
    
    // Fetch reviews (using string productId)
    const reviews = await Review.find({ 
      productId: productId,
      status: 'approved' 
    }).sort({ createdAt: -1 });

    console.log(`📋 Found ${reviews.length} reviews for product ${productId}`);
    
    // Calculate rating distribution
    const ratingDistribution = await Review.aggregate([
      { 
        $match: { 
          productId: productId,
          status: 'approved'
        }
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    // Ensure all ratings (1-5) are represented
    const fullRatingDistribution = [5, 4, 3, 2, 1].map(rating => {
      const found = ratingDistribution.find(r => r._id === rating);
      return {
        _id: rating,
        count: found ? found.count : 0
      };
    });

    // Get current user to check vote status
    const currentUser = getAuthenticatedUser(req);
    
    // FIXED: Add real user info to each review
    const reviewsWithVoteStatus = reviews.map(review => ({
      ...review.toObject(),
      hasUserVoted: currentUser ? review.helpfulBy.includes(currentUser._id) : false,
      userId: {
        name: review.userName || 'Anonymous User', // Use stored user name
        email: review.userEmail || 'user@example.com', // Use stored user email  
        profileImage: review.userProfileImage || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(review.userName || 'User')}&background=f97316&color=fff&size=100`
      }
    }));

    res.json({
      success: true,
      reviews: reviewsWithVoteStatus,
      totalReviews: reviews.length,
      ratingDistribution: fullRatingDistribution
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

// POST /api/reviews - Create new review with enhanced features
router.post('/', async (req, res) => {
  try {
    const { productId, rating, title, comment, images, currentUser } = req.body;
    
    console.log('📝 Creating review:', { productId, rating, title, currentUser: currentUser?.name });
    
    // Get user from request - FIXED
    const user = getAuthenticatedUser(req) || currentUser;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user data missing'
      });
    }
    
    // Enhanced validation
    if (!productId || !rating || !title || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      productId: productId,
      userId: user._id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }
    
    // Process images
    let processedImages = [];
    if (images && Array.isArray(images)) {
      processedImages = images.slice(0, 3);
      console.log(`📸 Processing ${processedImages.length} images for review`);
    }
    
    // FIXED: Store real user data in the review
    const newReview = new Review({
      productId: productId,
      userId: user._id,
      userName: user.name, // Store user name directly
      userEmail: user.email, // Store user email directly  
      userProfileImage: user.profileImage || user.avatar, // Store profile image
      rating: parseInt(rating),
      title: title.trim(),
      comment: comment.trim(),
      isVerifiedPurchase: false,
      helpfulVotes: 0,
      helpfulBy: [],
      status: 'approved',
      images: processedImages
    });
    
    const savedReview = await newReview.save();
    
    console.log(`✅ Review created by: ${user.name} with ${processedImages.length} images`);
    
    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      review: {
        ...savedReview.toObject(),
        hasUserVoted: false,
        userId: {
          name: user.name,
          email: user.email,
          profileImage: user.profileImage || user.avatar
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating review:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating review',
      error: error.message
    });
  }
});

// POST /api/reviews/:reviewId/helpful - Toggle helpful vote
router.post('/:reviewId/helpful', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const user = getAuthenticatedUser(req);
    
    // Allow voting without strict authentication (for testing)
    const votingUser = user || {
      _id: 'guest_' + Date.now()
    };
    
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    // Check if user already voted
    const hasVoted = review.helpfulBy.includes(votingUser._id);
    
    let updatedReview;
    
    if (hasVoted) {
      // Remove vote
      updatedReview = await Review.findByIdAndUpdate(
        reviewId,
        {
          $pull: { helpfulBy: votingUser._id },
          $inc: { helpfulVotes: -1 }
        },
        { new: true }
      );
      
      console.log(`👎 Vote removed from review ${reviewId}`);
      res.json({
        success: true,
        message: 'Vote removed successfully',
        helpfulVotes: Math.max(0, updatedReview.helpfulVotes),
        hasVoted: false
      });
    } else {
      // Add vote
      updatedReview = await Review.findByIdAndUpdate(
        reviewId,
        {
          $addToSet: { helpfulBy: votingUser._id },
          $inc: { helpfulVotes: 1 }
        },
        { new: true }
      );
      
      console.log(`👍 Vote added to review ${reviewId}`);
      res.json({
        success: true,
        message: 'Vote added successfully',
        helpfulVotes: updatedReview.helpfulVotes,
        hasVoted: true
      });
    }
    
  } catch (error) {
    console.error('❌ Error updating helpful vote:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating vote',
      error: error.message
    });
  }
});

// GET /api/reviews/:reviewId - Get single review
router.get('/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;
    
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    // Check if current user has voted
    const currentUser = getAuthenticatedUser(req);
    const hasUserVoted = currentUser ? review.helpfulBy.includes(currentUser._id) : false;
    
    res.json({
      success: true,
      review: {
        ...review.toObject(),
        hasUserVoted,
        userId: {
          name: 'Anonymous User',
          email: 'user@example.com',
          profileImage: 'https://ui-avatars.com/api/?name=User&background=f97316&color=fff&size=100'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching review:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching review',
      error: error.message
    });
  }
});

// DELETE /api/reviews/:reviewId - Delete review
router.delete('/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const user = getAuthenticatedUser(req);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    // Check if user owns the review (simplified check)
    if (review.userId !== user._id && !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }
    
    await Review.findByIdAndDelete(reviewId);
    
    console.log(`🗑️ Review ${reviewId} deleted`);
    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting review',
      error: error.message
    });
  }
});

// Health check with MongoDB stats
router.get('/health', async (req, res) => {
  try {
    const totalReviews = await Review.countDocuments();
    const averageRating = await Review.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);
    
    res.json({
      status: 'OK',
      service: 'Reviews API (Enhanced)',
      totalReviews,
      averageRating: averageRating[0]?.avgRating || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      service: 'Reviews API (Enhanced)',
      error: error.message
    });
  }
});

console.log('📋 Enhanced Reviews router configured with full features');

module.exports = router;
