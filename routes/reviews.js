// routes/reviews.js - MongoDB Integration
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Import your Review model
const Review = require('../models/Review');

// Middleware for authentication - extract real user from JWT
const getAuthenticatedUser = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded; // This should contain user._id, name, email, etc.
    } catch (error) {
      return null;
    }
  }
  return null;
};

// GET /api/reviews/product/:productId - Fetch reviews from MongoDB
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`🔍 Fetching reviews for product: ${productId}`);
    
    // Fetch reviews from MongoDB and populate user data
    const reviews = await Review.find({ 
      productId: productId,
      status: 'approved' // Only show approved reviews
    })
    .populate('userId', 'name email profileImage') // Populate user data
    .sort({ createdAt: -1 }) // Sort by newest first
    .exec();

    console.log(`📊 Found ${reviews.length} reviews for product ${productId}`);
    
    // Calculate rating distribution
    const ratingDistribution = await Review.aggregate([
      { 
        $match: { 
          productId: new mongoose.Types.ObjectId(productId),
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
    
    // Add hasUserVoted field to each review
    const reviewsWithVoteStatus = reviews.map(review => ({
      ...review.toObject(),
      hasUserVoted: currentUser ? review.helpfulBy.includes(currentUser._id) : false,
      userId: {
        name: review.userId?.name || 'Anonymous',
        email: review.userId?.email || '',
        profileImage: review.userId?.profileImage || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(review.userId?.name || 'User')}&background=f97316&color=fff&size=100`
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

// POST /api/reviews - Create new review in MongoDB
router.post('/', async (req, res) => {
  try {
    const { productId, rating, title, comment, images } = req.body;
    const user = getAuthenticatedUser(req);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Validation
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
    
    // Process images if provided
    let processedImages = [];
    if (images && Array.isArray(images)) {
      processedImages = images.slice(0, 3); // Limit to 3 images
      console.log(`📸 Processing ${processedImages.length} images for review`);
    }
    
    // Create new review in MongoDB
    const newReview = new Review({
      productId: new mongoose.Types.ObjectId(productId),
      userId: new mongoose.Types.ObjectId(user._id),
      rating: parseInt(rating),
      title: title.trim(),
      comment: comment.trim(),
      isVerifiedPurchase: true, // You can check this based on order history
      helpfulVotes: 0,
      helpfulBy: [],
      status: 'approved', // You might want 'pending' for moderation
      images: processedImages,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const savedReview = await newReview.save();
    
    // Populate user data for response
    const populatedReview = await Review.findById(savedReview._id)
      .populate('userId', 'name email profileImage')
      .exec();
    
    console.log(`✅ Review created in MongoDB by: ${user.name} with ${processedImages.length} images`);
    
    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      review: {
        ...populatedReview.toObject(),
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
      // Duplicate key error (unique constraint)
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

// POST /api/reviews/:reviewId/helpful - Toggle helpful vote in MongoDB
router.post('/:reviewId/helpful', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const user = getAuthenticatedUser(req);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Find the review in MongoDB
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    // Check if user already voted
    const hasVoted = review.helpfulBy.includes(user._id);
    
    let updatedReview;
    
    if (hasVoted) {
      // Remove vote
      updatedReview = await Review.findByIdAndUpdate(
        reviewId,
        {
          $pull: { helpfulBy: user._id },
          $inc: { helpfulVotes: -1 },
          updatedAt: new Date()
        },
        { new: true }
      );
      
      console.log(`👎 User ${user.name} removed helpful vote from review ${reviewId}`);
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
          $addToSet: { helpfulBy: user._id },
          $inc: { helpfulVotes: 1 },
          updatedAt: new Date()
        },
        { new: true }
      );
      
      console.log(`👍 User ${user.name} added helpful vote to review ${reviewId}`);
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

// GET /api/reviews/:reviewId - Get single review from MongoDB
router.get('/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;
    
    const review = await Review.findById(reviewId)
      .populate('userId', 'name email profileImage')
      .exec();
    
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
        hasUserVoted
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

// DELETE /api/reviews/:reviewId - Delete review (admin or owner only)
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
    
    // Check if user is the review owner or admin
    if (review.userId.toString() !== user._id && !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }
    
    await Review.findByIdAndDelete(reviewId);
    
    console.log(`🗑️ Review ${reviewId} deleted by ${user.name}`);
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

// Health check for reviews with MongoDB stats
router.get('/health', async (req, res) => {
  try {
    const totalReviews = await Review.countDocuments();
    const averageRating = await Review.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);
    
    res.json({
      status: 'OK',
      service: 'Reviews API (MongoDB)',
      totalReviews,
      averageRating: averageRating[0]?.avgRating || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      service: 'Reviews API (MongoDB)',
      error: error.message
    });
  }
});

console.log('📋 Reviews router configured with MongoDB integration');

module.exports = router;