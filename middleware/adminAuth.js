// middleware/adminAuth.js - Enhanced version
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const adminAuth = async (req, res, next) => {
  try {
    // Check for API key in headers (for simple auth)
    const adminKey = req.headers['admin-key'] || req.headers['x-admin-key'];
    
    // Check for JWT token in Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    // Method 1: Simple API key authentication
    if (adminKey) {
      const validApiKey = process.env.ADMIN_API_KEY || 'admin_secure_key_2024_change_this';
      
      if (adminKey === validApiKey) {
        req.admin = { 
          id: 'api-key-admin', 
          username: 'Emergency Admin',
          method: 'api-key',
          role: 'admin',
          permissions: ['payment_verification', 'order_management']
        };
        console.log('✅ Admin authenticated via API key');
        return next();
      } else {
        console.log('❌ Invalid API key provided');
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid admin API key' 
        });
      }
    }

    // Method 2: JWT token authentication
    if (token) {
      try {
        const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
        const decoded = jwt.verify(token, secret);
        
        // Get full admin details from database
        const admin = await Admin.findById(decoded.id).select('-password');
        
        if (!admin) {
          console.log('❌ Admin not found in database');
          return res.status(401).json({ 
            success: false, 
            message: 'Admin not found' 
          });
        }

        if (!admin.isActive) {
          console.log('❌ Admin account is inactive');
          return res.status(401).json({ 
            success: false, 
            message: 'Admin account is inactive' 
          });
        }

        // Update last activity (optional)
        admin.lastLogin = new Date();
        await admin.save({ validateBeforeSave: false });

        req.admin = {
          id: admin._id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
          permissions: admin.permissions || ['payment_verification'],
          method: 'jwt',
          lastLogin: admin.lastLogin
        };
        
        console.log('✅ Admin authenticated via JWT:', admin.username);
        return next();
        
      } catch (jwtError) {
        console.log('❌ JWT verification failed:', jwtError.message);
        
        // Different error messages for different JWT errors
        let message = 'Invalid admin token';
        if (jwtError.name === 'TokenExpiredError') {
          message = 'Admin token has expired';
        } else if (jwtError.name === 'JsonWebTokenError') {
          message = 'Malformed admin token';
        }
        
        return res.status(401).json({ 
          success: false, 
          message 
        });
      }
    }

    // No valid authentication found
    console.log('❌ No valid admin authentication provided');
    return res.status(401).json({ 
      success: false, 
      message: 'Admin authentication required. Please provide either admin-key or Bearer token.' 
    });

  } catch (error) {
    console.error('❌ Admin auth middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
    });
  }
};

module.exports = adminAuth;
