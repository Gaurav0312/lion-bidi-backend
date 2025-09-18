// routes/reviews.js - Production Ready
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Review = require('../models/Review');
const User = require('../models/User');
const router = express.Router();

// Production-ready authentication middleware
const getAuthenticatedUser = async (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId).select('-password');
    return user;
  } catch (error) {
    console.error('Authentication error:', error.message);
    return null;
  }
};

// Input validation middleware
const validateReviewInput = (req, res, next) => {
  const { productId, rating, title, comment } = req.body;
  const errors = [];

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    errors.push('Valid product ID is required');
  }

  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(Number(rating))) {
    errors.push('Rating must be an integer between 1 and 5');
  }

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Title is required');
  } else if (title.trim().length > 100) {
    errors.push('Title must be less than 100 characters');
  }

  if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
    errors.push('Comment is required');
  } else if (comment.trim().length > 1000) {
    errors.push('Comment must be less than 1000 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

// GET reviews for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    // Validate productId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    // Fetch reviews from MongoDB with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ 
      productId: new mongoose.Types.ObjectId(productId),
      status: 'approved' // Only show approved reviews
    })
    .populate('userId', 'name email profileImage')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const totalReviews = await Review.countDocuments({ 
      productId: new mongoose.Types.ObjectId(productId),
      status: 'approved'
    });

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
      { $sort: { _id: 1 } }
    ]);

    // Calculate average rating
    const avgRatingResult = await Review.aggregate([
      { 
        $match: { 
          productId: new mongoose.Types.ObjectId(productId),
          status: 'approved'
        } 
      },
      { 
        $group: { 
          _id: null, 
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        } 
      }
    ]);

    const averageRating = avgRatingResult.length > 0 ? 
      Math.round(avgRatingResult[0].averageRating * 10) / 10 : 0;

    // Format reviews for frontend
    const formattedReviews = reviews.map(review => ({
      _id: review._id,
      userId: {
        name: review.userId?.name || 'Anonymous User',
        email: review.userId?.email || '',
        profileImage: review.userId?.profileImage || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(review.userId?.name || 'Anonymous')}&background=f97316&color=fff&size=100`
      },
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      isVerifiedPurchase: review.isVerifiedPurchase,
      helpfulVotes: review.helpfulVotes,
      helpfulBy: review.helpfulBy || [],
      images: review.images || []
    }));

    res.json({
      success: true,
      data: {
        reviews: formattedReviews,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalReviews / limit),
          totalReviews,
          hasNextPage: page < Math.ceil(totalReviews / limit),
          hasPrevPage: page > 1
        },
        statistics: {
          averageRating,
          totalReviews,
          ratingDistribution: ratingDistribution.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST new review
router.post('/', validateReviewInput, async (req, res) => {
  try {
    const { productId, rating, title, comment, images } = req.body;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to submit a review.'
      });
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      productId: new mongoose.Types.ObjectId(productId),
      userId: user._id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    // Process and validate images
    let processedImages = [];
    if (images && Array.isArray(images)) {
      processedImages = images
        .filter(img => typeof img === 'string' && img.startsWith('data:image/'))
        .slice(0, 3); // Limit to 3 images
      
      // Validate image size (approximate check for base64)
      for (const img of processedImages) {
        const sizeInBytes = (img.length * 3) / 4;
        if (sizeInBytes > 5 * 1024 * 1024) { // 5MB limit
          return res.status(400).json({
            success: false,
            message: 'Image size must be less than 5MB'
          });
        }
      }
    }

    // Create new review
    const newReview = new Review({
      productId: new mongoose.Types.ObjectId(productId),
      userId: user._id,
      rating: parseInt(rating),
      title: title.trim(),
      comment: comment.trim(),
      images: processedImages,
      isVerifiedPurchase: true, // Set based on actual purchase verification
      status: 'approved' // Set to 'pending' if manual approval is required
    });

    const savedReview = await newReview.save();
    console.log(`✅ Review saved to MongoDB by user: ${user.name} (${user._id})`);

    // Populate user data for response
    await savedReview.populate('userId', 'name email profileImage');

    // Format response
    const formattedReview = {
      _id: savedReview._id,
      userId: {
        name: savedReview.userId.name,
        email: savedReview.userId.email,
        profileImage: savedReview.userId.profileImage || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(savedReview.userId.name)}&background=f97316&color=fff&size=100`
      },
      rating: savedReview.rating,
      title: savedReview.title,
      comment: savedReview.comment,
      createdAt: savedReview.createdAt,
      updatedAt: savedReview.updatedAt,
      isVerifiedPurchase: savedReview.isVerifiedPurchase,
      helpfulVotes: savedReview.helpfulVotes,
      helpfulBy: savedReview.helpfulBy,
      images: savedReview.images,
      status: savedReview.status
    };

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: {
        review: formattedReview
      }
    });

  } catch (error) {
    console.error('❌ Error creating review:', error);

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create review',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// PUT update helpful vote
router.put('/:reviewId/helpful', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID format'
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    const userIdString = user._id.toString();
    const hasVoted = review.helpfulBy.some(id => id.toString() === userIdString);

    if (hasVoted) {
      // Remove vote
      review.helpfulBy = review.helpfulBy.filter(id => id.toString() !== userIdString);
      review.helpfulVotes = Math.max(0, review.helpfulVotes - 1);
      await review.save();

      console.log(`👎 User ${user.name} removed helpful vote from review ${reviewId}`);
      
      res.json({
        success: true,
        message: 'Helpful vote removed',
        data: {
          helpfulVotes: review.helpfulVotes,
          hasVoted: false
        }
      });
    } else {
      // Add vote
      review.helpfulBy.push(user._id);
      review.helpfulVotes = review.helpfulVotes + 1;
      await review.save();

      console.log(`👍 User ${user.name} added helpful vote to review ${reviewId}`);
      
      res.json({
        success: true,
        message: 'Helpful vote added',
        data: {
          helpfulVotes: review.helpfulVotes,
          hasVoted: true
        }
      });
    }

  } catch (error) {
    console.error('❌ Error updating helpful vote:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update helpful vote',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// DELETE review (only by review owner or admin)
router.delete('/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID format'
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review or is admin
    if (review.userId.toString() !== user._id.toString() && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own reviews'
      });
    }

    await Review.findByIdAndDelete(reviewId);
    console.log(`🗑️ Review ${reviewId} deleted by user: ${user.name}`);

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete review',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Error handling middleware for this router
router.use((error, req, res, next) => {
  console.error('Review router error:', error);
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authentication token has expired'
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

module.exports = router;
