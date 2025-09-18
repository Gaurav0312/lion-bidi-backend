// routes/reviews.js - Complete working version
const express = require('express');
const router = express.Router();

console.log('📋 Reviews routes file loaded successfully');

// Mock reviews data
const mockReviews = {
  "1": [
    {
      _id: '1',
      userId: { 
        name: 'Rajesh Kumar', 
        email: 'rajesh@example.com' 
      },
      rating: 5,
      title: 'Excellent Quality',
      comment: 'Excellent quality! The taste is authentic and burns slowly. Worth every penny.',
      createdAt: new Date().toISOString(),
      isVerifiedPurchase: true,
      helpfulVotes: 12,
      images: []
    },
    {
      _id: '2',
      userId: { 
        name: 'Priya Sharma', 
        email: 'priya@example.com' 
      },
      rating: 4,
      title: 'Good Product',
      comment: 'Good quality bidi. Fast delivery and nice packaging.',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      isVerifiedPurchase: true,
      helpfulVotes: 8,
      images: []
    },
    {
      _id: '3',
      userId: { 
        name: 'Amit Patel', 
        email: 'amit@example.com' 
      },
      rating: 5,
      title: 'Best Purchase',
      comment: 'Amazing product! Quick delivery and excellent packaging. Highly recommended.',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      isVerifiedPurchase: true,
      helpfulVotes: 15,
      images: []
    }
  ],
  "2": [
    {
      _id: '4',
      userId: { 
        name: 'Anil Singh', 
        email: 'anil@example.com' 
      },
      rating: 4,
      title: 'Good Small Pack',
      comment: 'Good product, perfect size for trying. Nice packaging and fast delivery!',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      isVerifiedPurchase: true,
      helpfulVotes: 8,
      images: []
    },
    {
      _id: '5',
      userId: { 
        name: 'Mohit Kumar', 
        email: 'mohit@example.com' 
      },
      rating: 5,
      title: 'Premium Quality Small Pack',
      comment: 'Best small pack I\'ve tried. Premium quality at reasonable price. Perfect for occasional use.',
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      isVerifiedPurchase: true,
      helpfulVotes: 6,
      images: []
    }
  ]
};

// Middleware to log requests
router.use((req, res, next) => {
  console.log(`📋 Reviews API: ${req.method} ${req.originalUrl}`);
  next();
});

// Test route to verify reviews router is working
router.get('/test', (req, res) => {
  console.log('🧪 Reviews test route hit');
  res.json({ 
    message: 'Reviews routes are working!',
    timestamp: new Date().toISOString(),
    availableProducts: Object.keys(mockReviews)
  });
});

// GET /api/reviews/product/:productId
router.get('/product/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`🔍 Fetching reviews for product: ${productId}`);
    
    // Convert to string for consistent lookup
    const productKey = productId.toString();
    const productReviews = mockReviews[productKey] || [];
    
    console.log(`📊 Found ${productReviews.length} reviews for product ${productKey}`);
    
    // Calculate rating distribution
    const ratingCounts = [0, 0, 0, 0, 0]; // [1-star, 2-star, 3-star, 4-star, 5-star]
    
    productReviews.forEach(review => {
      if (review.rating >= 1 && review.rating <= 5) {
        ratingCounts[review.rating - 1]++;
      }
    });
    
    // Create rating distribution (5 stars first)
    const ratingDistribution = ratingCounts.map((count, index) => ({
      _id: index + 1,
      count: count
    })).reverse();
    
    const response = {
      success: true,
      reviews: productReviews,
      totalReviews: productReviews.length,
      ratingDistribution: ratingDistribution
    };
    
    console.log(`✅ Sending ${productReviews.length} reviews for product ${productKey}`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error in GET /product/:productId:', error);
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

// POST /api/reviews - Create new review
router.post('/', (req, res) => {
  try {
    const { productId, rating, title, comment } = req.body;
    
    console.log('📝 Creating review:', { productId, rating, title });
    
    // Validation
    if (!productId || !rating || !title || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['productId', 'rating', 'title', 'comment']
      });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }
    
    // Create new review
    const newReview = {
      _id: `review_${Date.now()}`,
      userId: {
        name: 'Current User',
        email: 'user@example.com'
      },
      rating: parseInt(rating),
      title: title.trim(),
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
      isVerifiedPurchase: true,
      helpfulVotes: 0,
      images: []
    };
    
    // Add to mock data
    const productKey = productId.toString();
    if (!mockReviews[productKey]) {
      mockReviews[productKey] = [];
    }
    mockReviews[productKey].unshift(newReview);
    
    console.log('✅ Review created successfully');
    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      review: newReview
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

// POST /api/reviews/:reviewId/helpful - Mark review helpful
router.post('/:reviewId/helpful', (req, res) => {
  try {
    const { reviewId } = req.params;
    console.log(`👍 Marking review ${reviewId} as helpful`);
    
    // Find and update review
    let found = false;
    let updatedVotes = 0;
    
    for (const productId in mockReviews) {
      const reviewIndex = mockReviews[productId].findIndex(r => r._id === reviewId);
      if (reviewIndex !== -1) {
        mockReviews[productId][reviewIndex].helpfulVotes += 1;
        updatedVotes = mockReviews[productId][reviewIndex].helpfulVotes;
        found = true;
        break;
      }
    }
    
    if (!found) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    console.log('✅ Helpful vote updated');
    res.json({
      success: true,
      message: 'Vote updated successfully',
      helpfulVotes: updatedVotes
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

// Health check for reviews
router.get('/health', (req, res) => {
  const totalReviews = Object.values(mockReviews).reduce((sum, reviews) => sum + reviews.length, 0);
  res.json({
    status: 'OK',
    service: 'Reviews API',
    totalReviews,
    availableProducts: Object.keys(mockReviews),
    timestamp: new Date().toISOString()
  });
});

console.log('📋 Reviews router configured with routes:', [
  'GET /test',
  'GET /product/:productId', 
  'POST /',
  'POST /:reviewId/helpful',
  'GET /health'
]);

module.exports = router;