// routes/reviews.js - Enhanced version with all features
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Import your Review model
const Review = require('../models/Review');

// Enhanced authentication middleware
const getAuthenticatedUser = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      // You'll need to decode your JWT token here
      // This is a simplified version - replace with your actual JWT decoding
      return {
        _id: 'user_123', // Get from decoded JWT
        name: 'Gaurav Verma', // Get from decoded JWT or user lookup
        email: 'gauravverma@312@gmail.com', // Get from decoded JWT or user lookup
        profileImage: 'https://ui-avatars.com/api/?name=Gaurav+Verma&background=f97316&color=fff&size=100'
      };
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
    
    // Debug: Check all reviews first
    const allReviews = await Review.find({});
    console.log(`📊 Total reviews in database: ${allReviews.length}`);
    
    if (allReviews.length > 0) {
      console.log('Sample productIds:', allReviews.slice(0, 3).map(r => ({
        id: r._id,
        productId: r.productId,
        type: typeof r.productId
      })));
    }
    
    // Fetch reviews (using string productId, not ObjectId)
    const reviews = await Review.find({ 
      productId: productId, // Use string comparison
      status: 'approved' 
    }).sort({ createdAt: -1 });

    console.log(`📋 Found ${reviews.length} reviews for product ${productId}`);
    
    // Calculate rating distribution (using string productId)
    const ratingDistribution = await Review.aggregate([
      { 
        $match: { 
          productId: productId, // Use string, not ObjectId
          status: 'approved'
        }
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } } // Sort by rating (5 to 1)
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
    
    // Add hasUserVoted field to each review with enhanced user info
    const reviewsWithVoteStatus = reviews.map(review => ({
      ...review.toObject(),
      hasUserVoted: currentUser ? review.helpfulBy.includes(currentUser._id) : false,
      userId: {
        name: 'Anonymous User', // Since we don't have real user data yet
        email: 'user@example.com',
        profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent('User')}&background=f97316&color=fff&size=100`
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
    const { productId, rating, title, comment, images } = req.body;
    const user = getAuthenticatedUser(req);
    
    console.log('📝 Creating review:', { productId, rating, title, hasUser: !!user });
    
    // For now, allow reviews without authentication (for testing)
    const reviewUser = user || {
      _id: 'guest_' + Date.now(),
      name: 'Anonymous User',
      email: 'guest@example.com',
      profileImage: 'https://ui-avatars.com/api/?name=Anonymous&background=f97316&color=fff&size=100'
    };
    
    // Enhanced validation
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

    // Check if user already reviewed this product (skip for guests)
    if (user) {
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
    }
    
    // Process images if provided
    let processedImages = [];
    if (images && Array.isArray(images)) {
      processedImages = images.slice(0, 3); // Limit to 3 images
      console.log(`📸 Processing ${processedImages.length} images for review`);
    }
    
    // Create new review (using string productId and userId)
    const newReview = new Review({
      productId: productId, // Store as string, not ObjectId
      userId: reviewUser._id, // Store as string
      rating: parseInt(rating),
      title: title.trim(),
      comment: comment.trim(),
      isVerifiedPurchase: false, // You can enhance this later
      helpfulVotes: 0,
      helpfulBy: [],
      status: 'approved',
      images: processedImages
    });
    
    const savedReview = await newReview.save();
    
    console.log(`✅ Review created by: ${reviewUser.name} with ${processedImages.length} images`);
    
    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      review: {
        ...savedReview.toObject(),
        hasUserVoted: false,
        userId: {
          name: reviewUser.name,
          email: reviewUser.email,
          profileImage: reviewUser.profileImage
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
