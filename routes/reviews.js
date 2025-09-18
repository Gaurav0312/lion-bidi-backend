// routes/reviews.js - String-based MongoDB Integration
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Import your Review model
const Review = require('../models/Review');

// Enhanced middleware for authentication - extract real user from JWT
const getAuthenticatedUser = (req) => {
  // Check if user data is passed in the request body (for testing)
  if (req.body.currentUser && req.body.currentUser._id) {
    return {
      _id: req.body.currentUser._id,
      name: req.body.currentUser.name || 'Unknown User',
      email: req.body.currentUser.email || 'unknown@example.com',
      profileImage: req.body.currentUser.profileImage || req.body.currentUser.avatar || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(req.body.currentUser.name || 'User')}&background=ff6b35&color=fff&size=100`
    };
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      
      // JWT decoding with fallback
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
        // Fallback decode without verification
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
      console.error('Error decoding token:', error);
      return null;
    }
  }
  return null;
};

// GET /api/reviews/product/:productId - Fetch reviews from MongoDB (String-based)
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`🔍 Fetching reviews for product: ${productId}`);
    
    // Fetch reviews from MongoDB - NO population needed since user data is stored directly
    const reviews = await Review.find({ 
      productId: productId, // Direct string comparison
      status: 'approved'
    })
    .sort({ createdAt: -1 })
    .exec();

    console.log(`📊 Found ${reviews.length} reviews for product ${productId}`);
    
    // Calculate rating distribution using string productId
    const ratingDistribution = await Review.aggregate([
      { 
        $match: { 
          productId: productId, // Direct string match, no ObjectId conversion
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
    
    // Use stored user data from review document
    const reviewsWithVoteStatus = reviews.map(review => ({
      ...review.toObject(),
      hasUserVoted: currentUser ? review.helpfulBy.includes(currentUser._id) : false,
      userId: {
        name: review.userName || 'Anonymous User',
        email: review.userEmail || 'user@example.com',
        profileImage: review.userProfileImage || review.userAvatar || 
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

// POST /api/reviews - Create new review in MongoDB (String-based)
router.post('/', async (req, res) => {
  try {
    const { productId, rating, title, comment, images, currentUser } = req.body;
    
    // Get user from JWT or request body
    const user = getAuthenticatedUser(req) || currentUser;
    
    if (!user || !user._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - valid user data missing'
      });
    }
    
    console.log('👤 Creating review for user:', { 
      id: user._id, 
      name: user.name, 
      email: user.email 
    });
    
    // Validation
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

    // Check if user already reviewed this product (string comparison)
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
    
    // Process images if provided
    let processedImages = [];
    if (images && Array.isArray(images)) {
      processedImages = images.slice(0, 3);
      console.log(`📸 Processing ${processedImages.length} images for review`);
    }
    
    // Create new review with user data stored directly
    const newReview = new Review({
      productId: productId, // String, not ObjectId
      userId: user._id, // String, not ObjectId
      userName: user.name, // Store user name directly
      userEmail: user.email, // Store user email directly
      userProfileImage: user.profileImage, // Store profile image directly
      rating: parseInt(rating),
      title: title.trim(),
      comment: comment.trim(),
      isVerifiedPurchase: true,
      helpfulVotes: 0,
      helpfulBy: [],
      status: 'approved',
      images: processedImages
    });
    
    const savedReview = await newReview.save();
    
    console.log(`✅ Review created in MongoDB by: ${user.name} (${user.email}) with ${processedImages.length} images`);
    
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

// POST /api/reviews/:reviewId/helpful - Toggle helpful vote (String-based)
router.post('/:reviewId/helpful', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const user = getAuthenticatedUser(req);
    
    // Allow voting even without authentication (with guest ID)
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
    
    // Check if user already voted (string comparison)
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
          $addToSet: { helpfulBy: votingUser._id },
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

// GET /api/reviews/:reviewId - Get single review (String-based)
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
          name: review.userName || 'Anonymous User',
          email: review.userEmail || 'user@example.com',
          profileImage: review.userProfileImage || review.userAvatar
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

// DELETE /api/reviews/:reviewId - Delete review (String-based)
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
    
    // Check if user is the review owner (string comparison)
    if (review.userId !== user._id && !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }
    
    await Review.findByIdAndDelete(reviewId);
    
    console.log(`🗑️ Review ${reviewId} deleted by ${user.name || user._id}`);
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

// GET /api/reviews/stats/:productId - Get product review statistics
router.get('/stats/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    const stats = await Review.getProductRatingStats(productId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error fetching review stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching review statistics',
      error: error.message
    });
  }
});

// Health check for reviews with MongoDB stats
router.get('/health', async (req, res) => {
  try {
    const totalReviews = await Review.countDocuments();
    const averageRating = await Review.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);
    
    res.json({
      status: 'OK',
      service: 'Reviews API (String-based MongoDB)',
      totalReviews,
      averageRating: averageRating[0]?.avgRating || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      service: 'Reviews API (String-based MongoDB)',
      error: error.message
    });
  }
});

console.log('📋 Reviews router configured with String-based MongoDB integration');

module.exports = router;
