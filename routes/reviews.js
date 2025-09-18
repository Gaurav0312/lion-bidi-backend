// routes/reviews.js - Enhanced version with corrected user data extraction
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'); // Add this import for JWT handling
const router = express.Router();

// Import your Review model
const Review = require('../models/Review');

// Enhanced authentication middleware with proper JWT decoding
const getAuthenticatedUser = (req) => {
  // Check if user data is passed in the request body (for testing without JWT)
  if (req.body.currentUser && req.body.currentUser._id) {
    return {
      _id: req.body.currentUser._id,
      name: req.body.currentUser.name || 'Unknown User',
      email: req.body.currentUser.email || 'unknown@example.com',
      profileImage: req.body.currentUser.profileImage || req.body.currentUser.avatar || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(req.body.currentUser.name || 'User')}&background=ff6b35&color=fff&size=100`
    };
  }
  
  // Try to get from Authorization header (JWT)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      
      // FIXED: Properly decode JWT token
      // Method 1: If you have a JWT secret, use jwt.verify()
      if (process.env.JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return {
          _id: decoded.id || decoded.userId || decoded.sub,
          name: decoded.name || decoded.username || 'User',
          email: decoded.email || 'user@example.com',
          profileImage: decoded.profileImage || decoded.avatar || decoded.picture ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(decoded.name || 'User')}&background=ff6b35&color=fff&size=100`
        };
      } else {
        // Method 2: If no secret available, decode payload only (less secure)
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return {
          _id: payload.id || payload.userId || payload.sub,
          name: payload.name || payload.username || 'User',
          email: payload.email || 'user@example.com',
          profileImage: payload.profileImage || payload.avatar || payload.picture ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.name || 'User')}&background=ff6b35&color=fff&size=100`
        };
      }
    } catch (error) {
      console.error('Error decoding JWT token:', error);
      return null;
    }
  }
  
  return null;
};

// GET /api/reviews/product/:productId - Fetch reviews with correct user data
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
    
    // FIXED: Use stored user data from reviews instead of hardcoded values
    const reviewsWithVoteStatus = reviews.map(review => ({
      ...review.toObject(),
      hasUserVoted: currentUser ? review.helpfulBy.includes(currentUser._id) : false,
      userId: {
        name: review.userName || 'Anonymous User',
        email: review.userEmail || 'user@example.com',
        profileImage: review.userProfileImage || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(review.userName || 'User')}&background=ff6b35&color=fff&size=100`
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

// POST /api/reviews - Create new review with proper user data
router.post('/', async (req, res) => {
  try {
    const { productId, rating, title, comment, images, currentUser } = req.body;
    
    console.log('📝 Creating review:', { productId, rating, title });
    
    // FIXED: Get user from JWT or request body properly
    const user = getAuthenticatedUser(req) || currentUser;
    
    if (!user || !user._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - valid user data missing'
      });
    }
    
    console.log('👤 Authenticated user:', { 
      id: user._id, 
      name: user.name, 
      email: user.email 
    });
    
    // Enhanced validation
    if (!productId || !rating || !title || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: productId, rating, title, comment'
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
      userId: user._id.toString()
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
    
    // FIXED: Store complete user data in the review
    const newReview = new Review({
      productId: productId,
      userId: user._id.toString(),
      userName: user.name,
      userEmail: user.email,
      userProfileImage: user.profileImage,
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
    
    console.log(`✅ Review created by: ${user.name} (${user.email}) with ${processedImages.length} images`);
    
    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      review: {
        ...savedReview.toObject(),
        hasUserVoted: false,
        userId: {
          name: user.name,
          email: user.email,
          profileImage: user.profileImage
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
    
    // FIXED: Better user identification for voting
    const votingUser = user || {
      _id: 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    };
    
    console.log('👍 Vote attempt by user:', votingUser._id);
    
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    // Check if user already voted
    const hasVoted = review.helpfulBy.includes(votingUser._id.toString());
    
    let updatedReview;
    
    if (hasVoted) {
      // Remove vote
      updatedReview = await Review.findByIdAndUpdate(
        reviewId,
        {
          $pull: { helpfulBy: votingUser._id.toString() },
          $inc: { helpfulVotes: -1 }
        },
        { new: true }
      );
      
      console.log(`👎 Vote removed from review ${reviewId} by user ${votingUser._id}`);
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
          $addToSet: { helpfulBy: votingUser._id.toString() },
          $inc: { helpfulVotes: 1 }
        },
        { new: true }
      );
      
      console.log(`👍 Vote added to review ${reviewId} by user ${votingUser._id}`);
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

// GET /api/reviews/:reviewId - Get single review with correct user data
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
    const hasUserVoted = currentUser ? review.helpfulBy.includes(currentUser._id.toString()) : false;
    
    res.json({
      success: true,
      review: {
        ...review.toObject(),
        hasUserVoted,
        userId: {
          name: review.userName || 'Anonymous User',
          email: review.userEmail || 'user@example.com',
          profileImage: review.userProfileImage || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(review.userName || 'User')}&background=ff6b35&color=fff&size=100`
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

// DELETE /api/reviews/:reviewId - Delete review with proper user validation
router.delete('/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const user = getAuthenticatedUser(req);
    
    if (!user || !user._id) {
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
    
    // FIXED: Proper user ownership check
    if (review.userId !== user._id.toString() && !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }
    
    await Review.findByIdAndDelete(reviewId);
    
    console.log(`🗑️ Review ${reviewId} deleted by user ${user._id}`);
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
      service: 'Reviews API (Enhanced with JWT)',
      totalReviews,
      averageRating: averageRating[0]?.avgRating || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      service: 'Reviews API (Enhanced with JWT)',
      error: error.message
    });
  }
});

console.log('📋 Enhanced Reviews router configured with proper JWT handling');

module.exports = router;
