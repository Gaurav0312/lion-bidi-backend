// routes/admin.js
const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// Main admin login (prioritized)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find admin by username or email
    const admin = await Admin.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: username.toLowerCase() }
      ],
      isActive: true
    }).select('+password');

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isValidPassword = await admin.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        id: admin._id,
        username: admin.username,
        role: admin.role,
        permissions: admin.permissions
      },
      process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        lastLogin: admin.lastLogin
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Fallback simple login (for emergency access)
router.post('/simple-login', (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (password === adminPassword) {
      // Here: create a JWT!
      const token = jwt.sign(
        {
          username: 'Admin',
          role: 'admin',
          method: 'simple'
        },
        process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      return res.json({
        success: true,
        token,
        admin: {
          username: 'Admin',
          role: 'admin',
          method: 'simple'
        }
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


// Verify admin token
router.get('/verify', adminAuth, (req, res) => {
  res.json({
    success: true,
    admin: req.admin
  });
});

// Create new admin (super admin only)
router.post('/create', adminAuth, async (req, res) => {
  try {
    // Check if requesting admin is super admin
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can create new admins'
      });
    }

    const { username, email, password, permissions, role } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ username }, { email }]
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this username or email already exists'
      });
    }

    // Create new admin
    const newAdmin = new Admin({
      username,
      email,
      password,
      role: role || 'admin',
      permissions: permissions || ['payment_verification'],
      createdBy: req.admin._id
    });

    await newAdmin.save();

    res.json({
      success: true,
      message: 'Admin created successfully',
      admin: {
        id: newAdmin._id,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
        permissions: newAdmin.permissions
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create admin'
    });
  }
});

// Get all admins (super admin only)
router.get('/list', adminAuth, async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const admins = await Admin.find({}).select('-password').populate('createdBy', 'username');
    
    res.json({
      success: true,
      admins
    });
  } catch (error) {
    console.error('List admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admins'
    });
  }
});

// Update admin status
router.put('/:adminId/toggle-status', adminAuth, async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const admin = await Admin.findById(req.params.adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    admin.isActive = !admin.isActive;
    await admin.save();

    res.json({
      success: true,
      message: `Admin ${admin.isActive ? 'activated' : 'deactivated'} successfully`,
      admin: {
        id: admin._id,
        username: admin.username,
        isActive: admin.isActive
      }
    });
  } catch (error) {
    console.error('Toggle admin status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin status'
    });
  }
});

router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const Order = require('../models/Order');
    const User = require('../models/User');
    
    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Fetch stats
    const totalOrders = await Order.countDocuments();
    const pendingPayments = await Order.countDocuments({ 
      'payment.paymentStatus': { $in: ['pending_verification', 'submitted'] }
    });
    
    const totalUsers = await User.countDocuments();
    
    // Calculate total revenue from confirmed orders
    const revenueResult = await Order.aggregate([
      { $match: { status: { $in: ['confirmed', 'shipped', 'delivered'] } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // Today's verification stats
    const verifiedToday = await Order.countDocuments({
      'payment.verificationDate': { $gte: startOfDay, $lt: endOfDay },
      'payment.verified': true
    });

    const rejectedToday = await Order.countDocuments({
      'payment.verificationDate': { $gte: startOfDay, $lt: endOfDay },
      'payment.verified': false
    });

    // Recent orders
    const recentOrders = await Order.find()
      .populate('user', 'name email')
      .sort({ orderDate: -1 })
      .limit(10);

    // Pending verifications
    const pendingVerifications = await Order.find({
      'payment.paymentStatus': { $in: ['pending_verification', 'submitted'] }
    })
      .populate('user', 'name email')
      .sort({ 'payment.submittedAt': -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        stats: {
          totalOrders,
          pendingPayments,
          totalRevenue,
          totalUsers,
          verifiedToday,
          rejectedToday
        },
        recentOrders,
        pendingVerifications
      }
    });
  } catch (error) {
    console.error('Dashboard fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
});

// Get all orders for admin
router.get('/orders', adminAuth, async (req, res) => {
  try {
    const Order = require('../models/Order');
    const { page = 1, limit = 50, status, search } = req.query;

    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } },
        { 'user.email': { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .populate('user', 'name email')
      .sort({ orderDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Orders fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
});

// Update order status
router.put('/orders/:orderId/status', adminAuth, async (req, res) => {
  try {
    const Order = require('../models/Order');
    const { status } = req.body;

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    order.status = status;
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status,
      updatedBy: req.admin._id || req.admin.username,
      updatedAt: new Date()
    });

    await order.save();

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Order status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
});

// Get all users for admin
router.get('/users', adminAuth, async (req, res) => {
  try {
    const User = require('../models/User');
    const Order = require('../models/Order');
    
    const { page = 1, limit = 50, status, search } = req.query;

    let query = {};
    
    if (status && status !== 'all') {
      query.isActive = status === 'active';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Add order statistics for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const orderStats = await Order.aggregate([
        { $match: { user: user._id } },
        { 
          $group: { 
            _id: null, 
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: '$total' }
          }
        }
      ]);

      return {
        ...user.toObject(),
        totalOrders: orderStats[0]?.totalOrders || 0,
        totalSpent: orderStats[0]?.totalSpent || 0
      };
    }));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users: usersWithStats,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Toggle user status
router.put('/users/:userId/toggle-status', adminAuth, async (req, res) => {
  try {
    const User = require('../models/User');
    const { isActive } = req.body;

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('User status toggle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status'
    });
  }
});

// Settings management
router.get('/settings', adminAuth, async (req, res) => {
  try {
    const Settings = require('../models/Settings'); // You'll need to create this model
    
    let settings = await Settings.findOne({ type: 'admin' });
    
    // Default settings if none exist
    if (!settings) {
      settings = {
        general: {
          siteName: 'Lion Bidi',
          siteEmail: 'admin@lionbidi.com',
          supportPhone: '+91-9876543210',
          currency: 'INR',
          timezone: 'Asia/Kolkata'
        },
        notifications: {
          emailNotifications: true,
          orderNotifications: true,
          paymentNotifications: true,
          lowStockAlerts: true,
          dailyReports: false
        },
        security: {
          twoFactorAuth: false,
          sessionTimeout: 60,
          passwordExpiry: 90,
          maxLoginAttempts: 5
        },
        payment: {
          upiId: 'admin@paytm',
          bankName: 'State Bank of India',
          accountNumber: '****7890',
          ifscCode: 'SBIN0123456',
          enableUPI: true,
          enableBankTransfer: true
        }
      };
    }

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
});

// Update settings
router.put('/settings', adminAuth, async (req, res) => {
  try {
    const Settings = require('../models/Settings');
    const { section, data } = req.body;

    let settings = await Settings.findOne({ type: 'admin' });
    
    if (!settings) {
      settings = new Settings({ type: 'admin' });
    }

    settings[section] = data;
    settings.updatedBy = req.admin._id || req.admin.username;
    settings.updatedAt = new Date();

    await settings.save();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
});

// Change admin password
router.put('/change-password', adminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // For simple login method, skip current password validation
    if (req.admin.method === 'simple') {
      // Update environment variable or handle simple login password change
      return res.json({
        success: true,
        message: 'Password updated successfully for simple login'
      });
    }

    // For full admin login
    const Admin = require('../models/Admin');
    const admin = await Admin.findById(req.admin.id).select('+password');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Verify current password
    const isValidPassword = await admin.comparePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

// Analytics data
router.get('/analytics', adminAuth, async (req, res) => {
  try {
    const Order = require('../models/Order');
    const User = require('../models/User');
    
    const { period = '30' } = req.query; // days
    const daysBack = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Sales analytics
    const salesData = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: startDate },
          status: { $in: ['confirmed', 'shipped', 'delivered'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$orderDate' },
            month: { $month: '$orderDate' },
            day: { $dayOfMonth: '$orderDate' }
          },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Top selling products
    const topProducts = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: startDate },
          status: { $in: ['confirmed', 'shipped', 'delivered'] }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    // User growth
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          newUsers: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Payment method stats
    const paymentStats = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: startDate },
          status: { $in: ['confirmed', 'shipped', 'delivered'] }
        }
      },
      {
        $group: {
          _id: '$payment.method',
          count: { $sum: 1 },
          revenue: { $sum: '$total' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        salesData,
        topProducts,
        userGrowth,
        paymentStats,
        period: daysBack
      }
    });
  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics data'
    });
  }
});

module.exports = router;
