//server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');


dotenv.config();
const app = express();

// CORS Configuration
app.use(cors({
  origin: ['http://localhost:3000','https://lionbidi.vercel.app','https://lionbidi.shop', 'https://www.lionbidi.shop','https://lionbidi.in', 'https://www.lionbidi.in'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'admin-key', 'x-admin-key']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

connectDB();

// Health check route
app.route('/health')
  .get((req, res) => {
    res.status(200).json({
      message: 'Server is running!',
      timestamp: new Date().toISOString()
    });
  })
  .head((req, res) => {
    res.sendStatus(200);
  });


// ✅ REGISTER ALL ROUTES (before error handlers)
try {
  console.log("📝 Loading auth routes...");
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log("✅ Auth routes loaded");
} catch (error) {
  console.error("❌ Error loading auth routes:", error.message);
}

try {
  console.log("👑 Loading admin routes...");
  const adminRoutes = require('./routes/admin');
  app.use('/api/admin', adminRoutes);
  console.log("✅ Admin routes loaded");
} catch (error) {
  console.error("❌ Error loading admin routes:", error.message);
}

try {
  console.log("📦 Loading product routes...");
  const productRoutes = require('./routes/products');
  app.use('/api/products', productRoutes);
  console.log("✅ Product routes loaded");
} catch (error) {
  console.error("❌ Error loading product routes:", error.message);
}

try {
  console.log("📂 Loading category routes...");
  const categoryRoutes = require('./routes/categories');
  app.use('/api/categories', categoryRoutes);
  console.log("✅ Category routes loaded");
} catch (error) {
  console.error("❌ Error loading category routes:", error.message);
}

try {
  console.log("🛒 Loading cart routes...");
  const cartRoutes = require('./routes/cart');
  app.use('/api/cart', cartRoutes);
  console.log("✅ Cart routes loaded");
} catch (error) {
  console.error("❌ Error loading cart routes:", error.message);
}

try {
  console.log("❤️ Loading wishlist routes...");
  const wishlistRoutes = require('./routes/wishlist');
  app.use('/api/wishlist', wishlistRoutes);
  console.log("✅ Wishlist routes loaded");
} catch (error) {
  console.error("❌ Error loading wishlist routes:", error.message);
}

try {
  console.log("📋 Loading order routes...");
  const orderRoutes = require('./routes/orders');
  app.use('/api/orders', orderRoutes);
  console.log("✅ Order routes loaded");
} catch (error) {
  console.error("❌ Error loading order routes:", error.message);
}

try {
  console.log("👥 Loading user routes...");
  const userRoutes = require('./routes/users');
  app.use('/api/users', userRoutes);
  console.log("✅ User routes loaded");
} catch (error) {
  console.error("❌ Error loading user routes:", error.message);
}

try {
  console.log("📧 Loading contact routes...");
  const contactRoutes = require('./routes/contact');
  app.use('/api/contact', contactRoutes);
  console.log("✅ Contact routes loaded");
} catch (error) {
  console.error("❌ Error loading contact routes:", error.message);
}

try {
  console.log("🏠 Loading address routes...");
  const addressRoutes = require('./routes/address');
  app.use('/api/address', addressRoutes);
  console.log("✅ Address routes loaded");
} catch (error) {
  console.error("❌ Error loading address routes:", error.message);
}

try {
  console.log("🚚 Loading delivery routes...");
  const deliveryRoutes = require('./routes/delivery');
  app.use('/api/delivery', deliveryRoutes);
  console.log("✅ Delivery routes loaded");
} catch (error) {
  console.error("❌ Error loading delivery routes:", error.message);
}

try {
  console.log("📋 Loading review routes...");
  const reviewRoutes = require('./routes/reviews');
  app.use('/api/reviews', reviewRoutes);
  console.log("✅ Review routes loaded");
} catch (error) {
  console.error("❌ Error loading review routes:", error.message);
}

console.log("🎯 All routes registered successfully!");



// 404 handler (MUST come after all route registrations)
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: ['/api/auth', '/api/admin', '/api/products', '/api/orders','/api/reviews', '/api/users', '/api/cart', '/api/wishlist', '/api/contact', '/api/address','/api/delivery', '/api/categories']
  });
});

// Error handling middleware (LAST)
app.use((err, req, res, next) => {
  console.error('💥 Server Error:', err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`👑 Admin login: http://localhost:${PORT}/api/admin/simple-login`);
  console.log(`👤 Auth routes: http://localhost:${PORT}/api/auth/`);
});

module.exports = app;
