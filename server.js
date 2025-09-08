// server.js - Debug version to find the problematic route
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const orderRoutes = require('./routes/orders');

dotenv.config();
const app = express();

// CORS Configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

connectDB();

// Health check route (test this first)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    message: 'Server is running!',
    timestamp: new Date().toISOString()
  });
});

// Import and use routes one by one to find the problematic one
try {
  console.log("Loading auth routes...");
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log("Auth routes loaded successfully");
} catch (error) {
  console.error("Error loading auth routes:", error.message);
}

try {
  console.log("Loading product routes...");
  const productRoutes = require('./routes/products');
  app.use('/api/products', productRoutes);
  console.log("Product routes loaded successfully");
} catch (error) {
  console.error("Error loading product routes:", error.message);
}

try {
  console.log("Loading category routes...");
  const categoryRoutes = require('./routes/categories');
  app.use('/api/categories', categoryRoutes);
  console.log("Category routes loaded successfully");
} catch (error) {
  console.error("Error loading category routes:", error.message);
}

try {
  console.log("Loading cart routes...");
  const cartRoutes = require('./routes/cart');
  app.use('/api/cart', cartRoutes);
  console.log("Cart routes loaded successfully");
} catch (error) {
  console.error("Error loading cart routes:", error.message);
}

try {
  console.log("Loading wishlist routes...");
  const wishlistRoutes = require('./routes/wishlist');
  app.use('/api/wishlist', wishlistRoutes);
  console.log("Wishlist routes loaded successfully");
} catch (error) {
  console.error("Error loading wishlist routes:", error.message);
}

try {
  console.log("Loading order routes...");
  const orderRoutes = require('./routes/orders');
  app.use('/api/orders', orderRoutes);
  console.log("Order routes loaded successfully");
} catch (error) {
  console.error("Error loading order routes:", error.message);
}

try {
  console.log("Loading user routes...");
  const userRoutes = require('./routes/users');
  app.use('/api/users', userRoutes);
  console.log("User routes loaded successfully");
} catch (error) {
  console.error("Error loading user routes:", error.message);
}

try {
  console.log("Loading contact routes...");
  const contactRoutes = require('./routes/contact');
  app.use('/api/contact', contactRoutes);
  console.log("Contact routes loaded successfully");
} catch (error) {
  console.error("Error loading contact routes:", error.message);
}

// 🔥 NEW: Address routes
try {
  console.log("Loading address routes...");
  const addressRoutes = require('./routes/address');
  app.use('/api/address', addressRoutes);
  console.log("Address routes loaded successfully");
} catch (error) {
  console.error("Error loading address routes:", error.message);
}

try {
  console.log("Loading order routes...");
  const orderRoutes = require('./routes/orders');
  app.use('/api/orders', orderRoutes);
  console.log("Order routes loaded successfully");
} catch (error) {
  console.error("Error loading order routes:", error.message);
}

try {
  console.log("Loading user routes...");
  const userRoutes = require('./routes/users');
  app.use('/api/users', userRoutes);
  console.log("User routes loaded successfully");
} catch (error) {
  console.error("Error loading user routes:", error.message);
}

try {
  console.log("Loading contact routes...");
  const contactRoutes = require('./routes/contact');
  app.use('/api/contact', contactRoutes);
  console.log("Contact routes loaded successfully");
} catch (error) {
  console.error("Error loading contact routes:", error.message);
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.method} ${req.path} not found` 
  });
});

app.use('/api/orders', orderRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
});

module.exports = app;