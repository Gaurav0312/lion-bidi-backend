// middleware/adminAuth.js - Improved admin authentication
const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
  try {
    // Check for API key in headers (for simple auth)
    const adminKey = req.headers['admin-key'];
    
    // Check for JWT token in Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    // Method 1: Simple API key authentication
    if (adminKey && adminKey === process.env.ADMIN_API_KEY) {
      req.admin = { id: 'api-key-admin', method: 'api-key' };
      return next();
    }

    // Method 2: JWT token authentication
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET);
        
        // Check if it's an admin token
        if (decoded.role !== 'admin') {
          return res.status(403).json({ 
            success: false, 
            message: 'Admin access required' 
          });
        }

        req.admin = decoded;
        return next();
      } catch (jwtError) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid admin token' 
        });
      }
    }

    // No valid authentication found
    return res.status(401).json({ 
      success: false, 
      message: 'Admin authentication required' 
    });

  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
    });
  }
};

module.exports = adminAuth;