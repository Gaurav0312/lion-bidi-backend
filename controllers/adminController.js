// controllers/adminController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');
const Order = require('../models/Order');
const User = require('../models/User');

// Token generation helper
const generateToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// ==================== AUTH CONTROLLERS ====================

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Optimized query with lean()
    const admin = await Admin.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: username.toLowerCase() }
      ],
      isActive: true
    })
    .select('+password')
    .lean();

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Password verification
    const isValidPassword = await bcrypt.compare(password, admin.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token with full admin data
    const token = generateToken({
      id: admin._id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions || ['payment_verification'],
      loginTime: Date.now()
    });

    // Async update - don't block response
    Admin.updateOne(
      { _id: admin._id },
      { lastLogin: new Date() }
    ).exec();

    // Remove password before sending
    delete admin.password;

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions || ['payment_verification']
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

exports.simpleLogin = (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    const token = generateToken({
      id: 'simple-admin',
      username: 'Admin',
      role: 'admin',
      method: 'simple',
      permissions: ['payment_verification', 'order_management'],
      loginTime: Date.now()
    });

    res.json({
      success: true,
      token,
      admin: {
        username: 'Admin',
        role: 'admin',
        method: 'simple',
        permissions: ['payment_verification', 'order_management']
      }
    });
  } catch (error) {
    console.error('Simple login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

exports.verifyToken = (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(
      token, 
      process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET
    );

    res.json({
      success: true,
      admin: {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions,
        method: decoded.method
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
    });
  }
};

// ==================== DASHBOARD CONTROLLER ====================

exports.getDashboard = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Parallel queries for maximum speed
    const [
      totalOrders,
      pendingPayments,
      totalUsers,
      verifiedToday,
      rejectedToday,
      totalRevenueResult,
      recentOrders,
      pendingVerifications
    ] = await Promise.all([
      Order.countDocuments(),
      
      Order.countDocuments({ 
        $or: [
          { 'payment.paymentStatus': 'pending_verification' },
          { 'payment.paymentStatus': 'submitted' },
          { status: 'pending_payment' }
        ]
      }),
      
      User.countDocuments(),
      
      Order.countDocuments({
        'payment.verificationDate': { $gte: startOfDay, $lte: endOfDay },
        'payment.verified': true
      }),
      
      Order.countDocuments({
        'payment.verificationDate': { $gte: startOfDay, $lte: endOfDay },
        'payment.verified': false
      }),
      
      Order.aggregate([
        { 
          $match: { 
            status: { $in: ['confirmed', 'shipped', 'delivered'] } 
          } 
        },
        { 
          $group: { 
            _id: null, 
            total: { $sum: '$total' } 
          } 
        }
      ]),
      
      Order.find()
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      
      Order.find({
        $or: [
          { 'payment.paymentStatus': 'pending_verification' },
          { 'payment.paymentStatus': 'submitted' }
        ]
      })
        .populate('userId', 'name email phone')
        .sort({ 'payment.submittedAt': -1 })
        .limit(10)
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalOrders,
          pendingPayments,
          totalRevenue: totalRevenueResult[0]?.total || 0,
          totalUsers,
          verifiedToday,
          rejectedToday
        },
        recentOrders: recentOrders.map(order => ({
          ...order,
          user: order.userId,
          orderDate: order.orderDate || order.createdAt
        })),
        pendingVerifications: pendingVerifications.map(order => ({
          ...order,
          user: order.userId
        }))
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
};

// ==================== ORDER CONTROLLERS ====================

exports.getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.orderNumber = { $regex: search, $options: 'i' };
    }

    // Parallel query for speed
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      
      Order.countDocuments(query)
    ]);

    res.json({
      success: true,
      orders: orders.map(order => ({
        ...order,
        user: order.userId,
        orderDate: order.orderDate || order.createdAt
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Use findOneAndUpdate for atomic operation
    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        status,
        $push: {
          statusHistory: {
            status,
            updatedBy: req.admin.id,
            updatedAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order status updated',
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
};

// ==================== USER CONTROLLERS ====================

exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const skip = (page - 1) * limit;

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

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      
      User.countDocuments(query)
    ]);

    // Get order stats efficiently
    const userIds = users.map(u => u._id);
    const orderStats = await Order.aggregate([
      { $match: { userId: { $in: userIds } } },
      { 
        $group: { 
          _id: '$userId',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$total' }
        }
      }
    ]);

    // Map stats to users
    const statsMap = {};
    orderStats.forEach(stat => {
      statsMap[stat._id.toString()] = {
        totalOrders: stat.totalOrders,
        totalSpent: stat.totalSpent
      };
    });

    const usersWithStats = users.map(user => ({
      ...user,
      totalOrders: statsMap[user._id.toString()]?.totalOrders || 0,
      totalSpent: statsMap[user._id.toString()]?.totalSpent || 0
    }));

    res.json({
      success: true,
      users: usersWithStats,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true, select: '-password' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status'
    });
  }
};

// ==================== ANALYTICS CONTROLLER ====================

exports.getAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const daysBack = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const [salesData, topProducts, userGrowth, paymentStats] = await Promise.all([
      // Sales analytics
      Order.aggregate([
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
      ]),

      // Top products
      Order.aggregate([
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
      ]),

      // User growth
      User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
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
      ]),

      // Payment stats
      Order.aggregate([
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
      ])
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
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
};