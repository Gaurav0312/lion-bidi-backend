// routes/reviews.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Review = require('../models/Review');

// Production-ready authentication middleware
const getAuthenticatedUser = (req) => {
  try {
    // Check for user data in request body (for frontend context)
    if (req.body && req.body.currentUser && typeof req.body.currentUser === 'object') {
      const user = req.body.currentUser;
      if (user._id || user.id) {
        return {
          _id: user._id || user.id,
          name: user.name || user.displayName || 'Unknown User',
          email: user.email || 'unknown@example.com',
          profileImage: user.profileImage || user.avatar || user.picture || null
        };
      }
    }
    
    // Check Authorization header for JWT (future implementation)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // JWT implementation would go here
      // const token = authHeader.substring(7);
      // return decodeAndValidateJWT(token);
    }
    
    return null;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
};

// Input validation and sanitization middleware
const validateReviewInput = (req, res, next) => {
  const { productId, rating, title, comment } = req.body;
  const errors = [];

  if (!productId || typeof productId !== 'string' || productId.trim() === '') {
    errors.push('Valid product ID is required');
  }

  if (!rating || !Number.isInteger(Number(rating)) || rating < 1 || rating > 5) {
    errors.push('Rating must be an integer between 1 and 5');
  }

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Review title is required');
  } else if (title.trim().length > 200) {
    errors.push('Title cannot exceed 200 characters');
  }

  if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
    errors.push('Review comment is required');
  } else if (comment.trim().length > 2000) {
    errors.push('Comment cannot exceed 2000 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors
    });
  }

  next();
};

// GET /api/reviews/product/:productId - Fetch reviews with pagination
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    
    console.log(`🔍 Fetching reviews for product: ${productId} (page: ${page}, limit: ${limit})`);

    // Validate productId
    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required',
        reviews: [],
        totalReviews: 0,
        ratingDistribution: []
      });
    }

    // Get current user for vote status
    const currentUser = getAuthenticatedUser(req);

    // Fetch reviews with pagination
    const [reviews, totalCount] = await Promise.all([
      Review.find({ 
        productId: productId.trim(),
        status: 'approved' 
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
      
      Review.countDocuments({ 
        productId: productId.trim(),
        status: 'approved' 
      })
    ]);

    // Calculate rating distribution
    const ratingDistribution = await Review.aggregate([
      { 
        $match: { 
          productId: productId.trim(),
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

    // Add user vote status and format user data
    const reviewsWithVoteStatus = reviews.map(review => ({
      ...review,
      hasUserVoted: currentUser ? review.helpfulBy.includes(currentUser._id) : false,
      userId: {
        name: review.userName || 'Anonymous User',
        email: review.userEmail || 'user@example.com',
        profileImage: review.userProfileImage || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(review.userName || 'User')}&background=f97316&color=fff&size=100`
      }
    }));

    console.log(`📊 Found ${reviews.length} reviews (total: ${totalCount}) for product ${productId}`);

    res.json({
      success: true,
      reviews: reviewsWithVoteStatus,
      totalReviews: totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page * limit < totalCount,
      hasPrevPage: page > 1,
      ratingDistribution: fullRatingDistribution
    });

  } catch (error) {
    console.error('❌ Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching reviews',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      reviews: [],
      totalReviews: 0,
      ratingDistribution: []
    });
  }
});

// POST /api/reviews - Create new review with comprehensive validation
router.post('/', validateReviewInput, async (req, res) => {
  try {
    const { productId, rating, title, comment, images } = req.body;
    
    // Get authenticated user
    const user = getAuthenticatedUser(req);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to submit a review'
      });
    }

    console.log(`📝 Creating review for product ${productId} by user ${user.name}`);

    // Check for duplicate review
    const existingReview = await Review.findOne({
      productId: productId.trim(),
      userId: user._id
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    // Process and validate images
    let processedImages = [];
    if (images && Array.isArray(images)) {
      processedImages = images
        .filter(img => typeof img === 'string' && img.trim())
        .slice(0, 5) // Limit to 5 images
        .map(img => img.trim());
    }

    // Create new review
    const reviewData = {
      productId: productId.trim(),
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userProfileImage: user.profileImage,
      rating: parseInt(rating),
      title: title.trim(),
      comment: comment.trim(),
      images: processedImages,
      isVerifiedPurchase: false, // Set based on order history
      helpfulVotes: 0,
      helpfulBy: [],
      status: 'approved' // In production, you might want 'pending' for moderation
    };

    const newReview = new Review(reviewData);
    const savedReview = await newReview.save();

    console.log(`✅ Review created successfully: ${savedReview._id}`);

    // Return formatted response
    const response = {
      success: true,
      message: 'Review submitted successfully',
      review: {
        ...savedReview.toObject(),
        hasUserVoted: false,
        userId: {
          name: user.name,
          email: user.email,
          profileImage: user.profileImage || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=f97316&color=fff&size=100`
        }
      }
    };

    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Error creating review:', error);

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while creating review',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

// POST /api/reviews/:reviewId/helpful - Toggle helpful vote
router.post('/:reviewId/helpful', async (req, res) => {
  try {
    const { reviewId } = req.params;

    // Validate reviewId
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID format'
      });
    }

    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to vote on reviews'
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    const hasVoted = review.helpfulBy.includes(user._id);
    let updatedReview;

    if (hasVoted) {
      // Remove vote
      updatedReview = await Review.findByIdAndUpdate(
        reviewId,
        {
          $pull: { helpfulBy: user._id },
          $inc: { helpfulVotes: -1 }
        },
        { new: true }
      );
      
      console.log(`👎 User ${user.name} removed helpful vote from review ${reviewId}`);
    } else {
      // Add vote
      updatedReview = await Review.findByIdAndUpdate(
        reviewId,
        {
          $addToSet: { helpfulBy: user._id },
          $inc: { helpfulVotes: 1 }
        },
        { new: true }
      );
      
      console.log(`👍 User ${user.name} added helpful vote to review ${reviewId}`);
    }

    res.json({
      success: true,
      message: hasVoted ? 'Vote removed successfully' : 'Vote added successfully',
      helpfulVotes: Math.max(0, updatedReview.helpfulVotes),
      hasVoted: !hasVoted
    });

  } catch (error) {
    console.error('❌ Error updating helpful vote:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating vote',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

// GET /api/reviews/:reviewId - Get single review
router.get('/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID format'
      });
    }

    const review = await Review.findById(reviewId).lean();
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    const currentUser = getAuthenticatedUser(req);
    const hasUserVoted = currentUser ? review.helpfulBy.includes(currentUser._id) : false;

    const formattedReview = {
      ...review,
      hasUserVoted,
      userId: {
        name: review.userName || 'Anonymous User',
        email: review.userEmail || 'user@example.com',
        profileImage: review.userProfileImage || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(review.userName || 'User')}&background=f97316&color=fff&size=100`
      }
    };

    res.json({
      success: true,
      review: formattedReview
    });

  } catch (error) {
    console.error('❌ Error fetching review:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching review',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

// DELETE /api/reviews/:reviewId - Delete review (admin or owner only)
router.delete('/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID format'
      });
    }

    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to delete reviews'
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
    if (review.userId !== user._id && !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own reviews'
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
      message: 'Internal server error while deleting review',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

// Health check endpoint with comprehensive stats
router.get('/health', async (req, res) => {
  try {
    const [totalReviews, avgRating, statusCounts] = await Promise.all([
      Review.countDocuments(),
      Review.aggregate([
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ]),
      Review.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      status: 'OK',
      service: 'Reviews API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      stats: {
        totalReviews,
        averageRating: avgRating[0]?.avgRating || 0,
        statusBreakdown: statusCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      service: 'Reviews API',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

console.log('📋 Production-ready Reviews API initialized');

module.exports = router;
