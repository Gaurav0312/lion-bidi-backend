// routes/reviews.js - IMPROVED VERSION
const express = require('express');
const router = express.Router();

// Enhanced mock reviews data with more products
const mockReviews = {
  1: [
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
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
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
      createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      isVerifiedPurchase: true,
      helpfulVotes: 15,
      images: []
    }
  ],
  2: [
    {
      _id: '4',
      userId: { 
        name: 'Anil Singh', 
        email: 'anil@example.com' 
      },
      rating: 4,
      title: 'Good Product',
      comment: 'Good product, nice packaging. Fast delivery too. Recommended!',
      createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
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
      title: 'Premium Quality',
      comment: 'Best bidi I\'ve tried. Premium quality at reasonable price.',
      createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
      isVerifiedPurchase: false,
      helpfulVotes: 6,
      images: []
    }
  ]
};

// Middleware to log all requests to this router
router.use((req, res, next) => {
  console.log(`📋 Reviews Route: ${req.method} ${req.originalUrl}`, {
    params: req.params,
    query: req.query,
    body: req.method === 'POST' ? req.body : undefined
  });
  next();
});

// GET /api/reviews/product/:productId
router.get('/product/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`🔍 Fetching reviews for product ID: ${productId}`);
    
    // Convert productId to string for consistent comparison
    const productKey = productId.toString();
    const productReviews = mockReviews[productKey] || [];
    
    console.log(`📊 Found ${productReviews.length} reviews for product ${productKey}`);
    
    // Calculate rating distribution
    const ratingCounts = [0, 0, 0, 0, 0]; // Index 0 = 1 star, Index 4 = 5 stars
    productReviews.forEach(review => {
      if (review.rating >= 1 && review.rating <= 5) {
        ratingCounts[review.rating - 1]++;
      }
    });
    
    // Create rating distribution array (5 stars first)
    const ratingDistribution = ratingCounts.map((count, index) => ({
      _id: index + 1, // Rating value (1-5)
      count: count
    })).reverse(); // Reverse to show 5 stars first
    
    const responseData = {
      reviews: productReviews,
      totalReviews: productReviews.length,
      ratingDistribution: ratingDistribution,
      success: true
    };
    
    console.log(`✅ Sending response:`, {
      reviewCount: productReviews.length,
      totalReviews: responseData.totalReviews,
      distributionLength: ratingDistribution.length
    });
    
    res.status(200).json(responseData);
    
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

// POST /api/reviews - Create a new review
router.post('/', (req, res) => {
  try {
    const { productId, rating, title, comment } = req.body;
    
    console.log('📝 Creating new review:', { 
      productId, 
      rating, 
      title: title?.substring(0, 50) + '...' 
    });
    
    // Validate required fields
    if (!productId || !rating || !title || !comment) {
      console.log('❌ Validation failed - missing required fields');
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: productId, rating, title, and comment are required',
        required: ['productId', 'rating', 'title', 'comment'],
        received: { productId: !!productId, rating: !!rating, title: !!title, comment: !!comment }
      });
    }
    
    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
        received: rating
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
    
    // Add to mock data (in real app, save to database)
    const productKey = productId.toString();
    if (!mockReviews[productKey]) {
      mockReviews[productKey] = [];
    }
    mockReviews[productKey].unshift(newReview); // Add to beginning
    
    console.log('✅ Review created successfully with ID:', newReview._id);
    
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

// POST /api/reviews/:reviewId/helpful - Mark review as helpful
router.post('/:reviewId/helpful', (req, res) => {
  try {
    const { reviewId } = req.params;
    
    console.log(`👍 Marking review ${reviewId} as helpful`);
    
    // Find and update the review (in real app, update database)
    let reviewFound = false;
    let updatedReview = null;
    
    for (const productId in mockReviews) {
      const reviewIndex = mockReviews[productId].findIndex(r => r._id === reviewId);
      if (reviewIndex !== -1) {
        mockReviews[productId][reviewIndex].helpfulVotes += 1;
        updatedReview = mockReviews[productId][reviewIndex];
        reviewFound = true;
        break;
      }
    }
    
    if (!reviewFound) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
        reviewId
      });
    }
    
    console.log('✅ Helpful vote updated successfully');
    res.json({ 
      success: true,
      message: 'Vote updated successfully', 
      helpfulVotes: updatedReview.helpfulVotes,
      hasVoted: true
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

// GET /api/reviews/:reviewId - Get single review
router.get('/:reviewId', (req, res) => {
  try {
    const { reviewId } = req.params;
    
    console.log(`🔍 Fetching single review: ${reviewId}`);
    
    // Find review in mock data
    let foundReview = null;
    for (const productId in mockReviews) {
      const review = mockReviews[productId].find(r => r._id === reviewId);
      if (review) {
        foundReview = review;
        break;
      }
    }
    
    if (!foundReview) {
      return res.status(404).json({ 
        success: false,
        message: 'Review not found',
        reviewId 
      });
    }
    
    console.log('✅ Review found:', foundReview._id);
    res.json({ 
      success: true,
      review: foundReview 
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

// Health check for this router
router.get('/health', (req, res) => {
  const totalReviews = Object.values(mockReviews).reduce((sum, reviews) => sum + reviews.length, 0);
  res.json({
    status: 'OK',
    service: 'Reviews API',
    timestamp: new Date().toISOString(),
    totalReviews,
    availableProducts: Object.keys(mockReviews)
  });
});

module.exports = router;