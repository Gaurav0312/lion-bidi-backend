// middleware/adminAuth.js - OPTIMIZED VERSION
const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    
    // Attach decoded data directly - NO DATABASE CALL!
    req.admin = {
      id: decoded.id || decoded._id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || ['payment_verification'],
      method: decoded.method
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
    });
  }
};

module.exports = adminAuth;