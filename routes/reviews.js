// routes/reviews.js - Fixed version for your current setup
const express = require('express');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const router = express.Router();

// Simple authentication check (using your existing pattern)
const getAuthenticatedUser = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return {
      _id: new mongoose.Types.ObjectId(), // Generate a proper ObjectId
      name: 'Gaurav Verma',
      email: 'gauravverma@312@gmail.com',
      profileImage: 'https://ui-avatars.com/api/?name=Gaurav+Verma&background=f97316&color=fff&size=100'
    };
  }
  return null;
};

// GET reviews for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`📖 Fetching reviews for product: ${productId}`);

    const reviews = await Review.find({ productId })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${reviews.length} reviews`);

    const formattedReviews = reviews.map(review => ({
      _id: review._id,
      userId: {
        name: review.userId?.name || 'Anonymous User',
        email: review.userId?.email || '',
        profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(review.userId?.name || 'Anonymous')}&background=f97316&color=fff&size=100`
      },
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      createdAt: review.createdAt,
      isVerifiedPurchase: review.isVerifiedPurchase,
      helpfulVotes: review.helpfulVotes,
      helpfulBy: review.helpfulBy || [],
      images: review.images || []
    }));

    res.json({
      success: true,
      reviews: formattedReviews,
      totalReviews: reviews.length
    });

  } catch (error) {
    console.error('❌ Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: error.message
    });
  }
});

// POST new review
router.post('/', async (req, res) => {
  try {
    const { productId, rating, title, comment, images } = req.body;
    const user = getAuthenticatedUser(req);

    console.log('📝 Creating new review:', { productId, rating, title, user: user?.name });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Basic validation
    if (!productId || !rating || !title || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Process images
    let processedImages = [];
    if (images && Array.isArray(images)) {
      processedImages = images.slice(0, 3);
      console.log(`📸 Processing ${processedImages.length} images`);
    }

    // Create new review
    const newReview = new Review({
      productId: productId,
      userId: user._id,
      rating: parseInt(rating),
      title: title.trim(),
      comment: comment.trim(),
      images: processedImages,
      isVerifiedPurchase: true
    });

    const savedReview = await newReview.save();
    console.log(`✅ Review saved to MongoDB with ID: ${savedReview._id}`);

    const formattedReview = {
      _id: savedReview._id,
      userId: {
        name: user.name,
        email: user.email,
        profileImage: user.profileImage
      },
      rating: savedReview.rating,
      title: savedReview.title,
      comment: savedReview.comment,
      createdAt: savedReview.createdAt,
      isVerifiedPurchase: savedReview.isVerifiedPurchase,
      helpfulVotes: savedReview.helpfulVotes,
      images: savedReview.images
    };

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      review: formattedReview
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

module.exports = router;
