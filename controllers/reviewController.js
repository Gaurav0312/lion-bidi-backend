const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const mongoose = require('mongoose'); // ✅ MISSING IMPORT ADDED

// Helper function to update product rating - MOVED TO TOP
const updateProductRating = async (productId) => {
  try {
    const stats = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId), status: 'approved' } }, // ✅ FIXED ObjectId usage
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      await Product.findByIdAndUpdate(productId, {
        rating: Math.round(stats[0].averageRating * 10) / 10,
        reviewCount: stats[0].totalReviews
      });
    }
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
};

// Create a new review
exports.createReview = async (req, res) => {
  try {
    const { productId, rating, title, comment, images } = req.body;
    const userId = req.user?.id; // ✅ ADDED OPTIONAL CHAINING

    // ✅ ADDED VALIDATION
    if (!productId || !rating || !title || !comment) {
      return res.status(400).json({ 
        message: 'Missing required fields: productId, rating, title, and comment are required' 
      });
    }

    if (!userId) {
      return res.status(401).json({ message: 'User authentication required' });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ productId, userId });
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this product' });
    }

    // Check if user purchased this product (verified purchase)
    const hasPurchased = await Order.findOne({
      userId,
      'items.productId': productId,
      status: 'delivered'
    });

    const review = new Review({
      productId,
      userId,
      rating: parseInt(rating), // ✅ ENSURE INTEGER
      title: title.trim(),
      comment: comment.trim(),
      images: images || [],
      isVerifiedPurchase: !!hasPurchased
    });

    await review.save();
    
    // Update product rating statistics
    await updateProductRating(productId);

    // ✅ POPULATE USER DATA IN RESPONSE
    await review.populate('userId', 'name email');

    res.status(201).json({ 
      message: 'Review submitted successfully', 
      review 
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ 
      message: 'Error creating review', 
      error: error.message 
    });
  }
};

// Get reviews for a product
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;

    // ✅ ADDED VALIDATION
    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // ✅ VALIDATE MONGODB OBJECTID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // ✅ LIMIT MAX RESULTS

    const reviews = await Review.find({ 
      productId, 
      status: 'approved' 
    })
    .populate('userId', 'name email')
    .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
    .limit(limitNum)
    .skip((pageNum - 1) * limitNum);

    const totalReviews = await Review.countDocuments({ 
      productId, 
      status: 'approved' 
    });
    
    // Get rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId), status: 'approved' } }, // ✅ FIXED ObjectId
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    res.json({
      reviews,
      totalReviews,
      ratingDistribution,
      currentPage: pageNum,
      totalPages: Math.ceil(totalReviews / limitNum)
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ 
      message: 'Error fetching reviews', 
      error: error.message 
    });
  }
};

// Mark review as helpful
exports.markHelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user?.id;

    // ✅ ADDED VALIDATION
    if (!reviewId) {
      return res.status(400).json({ message: 'Review ID is required' });
    }

    if (!userId) {
      return res.status(401).json({ message: 'User authentication required' });
    }

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: 'Invalid review ID format' });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const hasVoted = review.helpfulBy.includes(userId);
    
    if (hasVoted) {
      // Remove vote
      review.helpfulBy.pull(userId);
      review.helpfulVotes = Math.max(0, review.helpfulVotes - 1); // ✅ PREVENT NEGATIVE VALUES
    } else {
      // Add vote
      review.helpfulBy.push(userId);
      review.helpfulVotes += 1;
    }

    await review.save();
    res.json({ 
      message: 'Vote updated successfully', 
      helpfulVotes: review.helpfulVotes,
      hasVoted: !hasVoted // ✅ RETURN CURRENT STATE
    });
  } catch (error) {
    console.error('Mark helpful error:', error);
    res.status(500).json({ 
      message: 'Error updating vote', 
      error: error.message 
    });
  }
};

// ✅ ADDED: Get single review
exports.getReviewById = async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: 'Invalid review ID format' });
    }

    const review = await Review.findById(reviewId)
      .populate('userId', 'name email')
      .populate('productId', 'name');

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ review });
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({ 
      message: 'Error fetching review', 
      error: error.message 
    });
  }
};

// ✅ ADDED: Update review (for user's own reviews)
exports.updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, title, comment, images } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User authentication required' });
    }

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: 'Invalid review ID format' });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user owns this review
    if (review.userId.toString() !== userId) {
      return res.status(403).json({ message: 'You can only update your own reviews' });
    }

    // Update fields
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }
      review.rating = parseInt(rating);
    }
    if (title !== undefined) review.title = title.trim();
    if (comment !== undefined) review.comment = comment.trim();
    if (images !== undefined) review.images = images;
    
    review.updatedAt = new Date();

    await review.save();
    
    // Update product rating statistics
    await updateProductRating(review.productId);

    await review.populate('userId', 'name email');

    res.json({ 
      message: 'Review updated successfully', 
      review 
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ 
      message: 'Error updating review', 
      error: error.message 
    });
  }
};

// ✅ ADDED: Delete review
exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User authentication required' });
    }

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: 'Invalid review ID format' });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user owns this review
    if (review.userId.toString() !== userId) {
      return res.status(403).json({ message: 'You can only delete your own reviews' });
    }

    const productId = review.productId;
    await Review.findByIdAndDelete(reviewId);
    
    // Update product rating statistics
    await updateProductRating(productId);

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ 
      message: 'Error deleting review', 
      error: error.message 
    });
  }
};
