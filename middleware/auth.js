// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // ✅ direct import

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    // ✅ Verify token using env secret only
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found for this token',
        code: 'USER_NOT_FOUND'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('❌ JWT verification failed:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Token verification failed',
      code: 'AUTH_ERROR'
    });
  }
};

module.exports = auth;
