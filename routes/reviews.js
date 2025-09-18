// routes/reviews.js - Updated to use real user data
const express = require('express');
const router = express.Router();

// Mock data with helpful votes tracking
const mockReviews = {
  "1": [
    {
      _id: '1',
      userId: { 
        name: 'Rajesh Kumar', 
        email: 'rajesh@example.com',
        profileImage: 'https://ui-avatars.com/api/?name=Rajesh+Kumar&background=f97316&color=fff&size=100'
      },
      rating: 5,
      title: 'Excellent Quality',
      comment: 'Excellent quality! The taste is authentic and burns slowly. Worth every penny.',
      createdAt: new Date().toISOString(),
      isVerifiedPurchase: true,
      helpfulVotes: 12,
      helpfulBy: ['user_456', 'user_789'], // Track users who voted helpful
      images: []
    },
    {
      _id: '3',
      userId: { 
        name: 'Amit Patel', 
        email: 'amit@example.com',
        profileImage: 'https://ui-avatars.com/api/?name=Amit+Patel&background=3b82f6&color=fff&size=100'
      },
      rating: 5,
      title: 'Best Purchase',
      comment: 'Amazing product! Quick delivery and excellent packaging. Highly recommended.',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      isVerifiedPurchase: true,
      helpfulVotes: 15,
      helpfulBy: ['user_456'],
      images: []
    },
    {
      _id: '4',
      userId: { 
        name: 'Priya Sharma', 
        email: 'priya@example.com',
        profileImage: 'https://ui-avatars.com/api/?name=Priya+Sharma&background=ec4899&color=fff&size=100'
      },
      rating: 4,
      title: 'Good Product',
      comment: 'Good quality bidi. Fast delivery and nice packaging.',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      isVerifiedPurchase: true,
      helpfulVotes: 8,
      helpfulBy: [],
      images: []
    }
  ],
  "2": [
    {
      _id: '5',
      userId: { 
        name: 'Anil Singh', 
        email: 'anil@example.com',
        profileImage: 'https://ui-avatars.com/api/?name=Anil+Singh&background=10b981&color=fff&size=100'
      },
      rating: 4,
      title: 'Good Small Pack',
      comment: 'Good product, perfect size for trying. Nice packaging and fast delivery!',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      isVerifiedPurchase: true,
      helpfulVotes: 8,
      helpfulBy: [],
      images: []
    },
    {
      _id: '6',
      userId: { 
        name: 'Mohit Kumar', 
        email: 'mohit@example.com',
        profileImage: 'https://ui-avatars.com/api/?name=Mohit+Kumar&background=8b5cf6&color=fff&size=100'
      },
      rating: 5,
      title: 'Premium Quality Small Pack',
      comment: 'Best small pack I\'ve tried. Premium quality at reasonable price. Perfect for occasional use.',
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      isVerifiedPurchase: true,
      helpfulVotes: 6,
      helpfulBy: ['user_456'],
      images: []
    }
  ]
};

// Middleware for authentication (simplified)
const getAuthenticatedUser = (req) => {
  // In a real app, you'd extract user from JWT token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // For now, return mock user data based on token
    return {
      _id: 'user_123',
      name: 'Gaurav Verma', // Use actual user name from your auth system
      email: 'gauravverma@312@gmail.com',
      profileImage: 'https://ui-avatars.com/api/?name=Gaurav+Verma&background=f97316&color=fff&size=100'
    };
  }
  return null;
};

router.get('/product/:productId', (req, res) => {
  const { productId } = req.params;
  const productReviews = mockReviews[productId] || [];
  
  const ratingDistribution = [
    { _id: 5, count: productReviews.filter(r => r.rating === 5).length },
    { _id: 4, count: productReviews.filter(r => r.rating === 4).length },
    { _id: 3, count: productReviews.filter(r => r.rating === 3).length },
    { _id: 2, count: productReviews.filter(r => r.rating === 2).length },
    { _id: 1, count: productReviews.filter(r => r.rating === 1).length }
  ];

  res.json({
    success: true,
    reviews: productReviews,
    totalReviews: productReviews.length,
    ratingDistribution
  });
});

router.post('/', (req, res) => {
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
    
    // Validate images if provided
    let processedImages = [];
    if (images && Array.isArray(images)) {
      processedImages = images.slice(0, 3); // Limit to 3 images
      console.log(`📸 Processing ${processedImages.length} images for review`);
    }
    
    // Create new review with real user data and images
    const newReview = {
      _id: `review_${Date.now()}`,
      userId: {
        name: user.name,
        email: user.email,
        profileImage: user.profileImage
      },
      rating: parseInt(rating),
      title: title.trim(),
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
      isVerifiedPurchase: true,
      helpfulVotes: 0,
      images: processedImages // Store the base64 images
    };
    
    // Add to mock data
    const productKey = productId.toString();
    if (!mockReviews[productKey]) {
      mockReviews[productKey] = [];
    }
    mockReviews[productKey].unshift(newReview);
    
    console.log(`✅ Review created by: ${user.name} with ${processedImages.length} images`);
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

router.post('/:reviewId/helpful', (req, res) => {
  try {
    const { reviewId } = req.params;
    const user = getAuthenticatedUser(req);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Find the review
    let foundReview = null;
    let productKey = null;
    let reviewIndex = -1;
    
    for (const pId in mockReviews) {
      const index = mockReviews[pId].findIndex(r => r._id === reviewId);
      if (index !== -1) {
        foundReview = mockReviews[pId][index];
        productKey = pId;
        reviewIndex = index;
        break;
      }
    }
    
    if (!foundReview) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    // Check if user already voted
    const helpfulBy = foundReview.helpfulBy || [];
    const hasVoted = helpfulBy.includes(user._id);
    
    if (hasVoted) {
      // User already voted - remove vote (toggle)
      foundReview.helpfulBy = helpfulBy.filter(id => id !== user._id);
      foundReview.helpfulVotes = Math.max(0, foundReview.helpfulVotes - 1);
      
      console.log(`👎 User ${user.name} removed helpful vote from review ${reviewId}`);
      res.json({
        success: true,
        message: 'Vote removed successfully',
        helpfulVotes: foundReview.helpfulVotes,
        hasVoted: false
      });
    } else {
      // User hasn't voted - add vote
      foundReview.helpfulBy = [...helpfulBy, user._id];
      foundReview.helpfulVotes = foundReview.helpfulVotes + 1;
      
      console.log(`👍 User ${user.name} added helpful vote to review ${reviewId}`);
      res.json({
        success: true,
        message: 'Vote added successfully',
        helpfulVotes: foundReview.helpfulVotes,
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

module.exports = router;