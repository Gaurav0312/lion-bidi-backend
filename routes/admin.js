// routes/admin.js
const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const adminController = require('../controllers/adminController');

const router = express.Router();

// ==================== AUTH ROUTES ====================
router.post('/login', adminController.login);
router.post('/simple-login', adminController.simpleLogin);
router.get('/verify', adminController.verifyToken);

// ==================== DASHBOARD ====================
router.get('/dashboard', adminAuth, adminController.getDashboard);

// ==================== ORDER MANAGEMENT ====================
router.get('/orders', adminAuth, adminController.getOrders);
router.put('/orders/:orderId/status', adminAuth, adminController.updateOrderStatus);

// ==================== USER MANAGEMENT ====================
router.get('/users', adminAuth, adminController.getUsers);
router.put('/users/:userId/toggle-status', adminAuth, adminController.toggleUserStatus);

// ==================== ANALYTICS ====================
router.get('/analytics', adminAuth, adminController.getAnalytics);

// ==================== ADMIN MANAGEMENT ====================

// Create new admin (super admin only)
router.post('/create', adminAuth, async (req, res) => {
  try {
    const Admin = require('../models/Admin');
    
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can create new admins'
      });
    }

    const { username, email, password, permissions, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    // Check if admin already exists - use lean() for speed
    const existingAdmin = await Admin.findOne({
      $or: [{ username }, { email }]
    }).lean();

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
      createdBy: req.admin.id
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
    const Admin = require('../models/Admin');
    
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Use lean() for faster queries
    const admins = await Admin.find({})
      .select('-password')
      .populate('createdBy', 'username')
      .lean();
    
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

// Update admin status (super admin only)
router.put('/:adminId/toggle-status', adminAuth, async (req, res) => {
  try {
    const Admin = require('../models/Admin');
    
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Use findByIdAndUpdate for atomic operation
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

// ==================== NOTIFICATIONS ====================
router.get('/notifications', adminAuth, async (req, res) => {
  try {
    const Order = require('../models/Order');
    const notifications = [];
    
    // Check for urgent pending payments
    const urgentPayments = await Order.countDocuments({
      'payment.paymentStatus': 'pending_verification',
      'payment.submittedAt': { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    if (urgentPayments > 0) {
      notifications.push({
        id: 1,
        type: 'urgent',
        title: 'Overdue Payments',
        message: `${urgentPayments} payments overdue for verification`,
        time: new Date(),
        action: '/admin/payment-verification'
      });
    }
    
    res.json({
      success: true,
      notifications
    });
  } catch (error) {
    res.json({ success: true, notifications: [] });
  }
});

// ==================== SETTINGS MANAGEMENT ====================

// Get settings
router.get('/settings', adminAuth, async (req, res) => {
  try {
    const Settings = require('../models/Settings');
    
    let settings = await Settings.findOne({ type: 'admin' }).lean();
    
    // Default settings if none exist
    if (!settings) {
      settings = {
        general: {
          siteName: 'Lion Bidi',
          siteEmail: 'lionbidicompany@gmail.com',
          supportPhone: '+91-9589773525',
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
          passwordExpiry: 900,
          maxLoginAttempts: 5
        },
        payment: {
          upiId: '9589773525@ptsbi',
          bankName: 'State Bank of India',
          accountNumber: '43075322727',
          ifscCode: 'SBIN000034',
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
    settings.updatedBy = req.admin.id;
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

// ==================== PASSWORD MANAGEMENT ====================

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

    // For simple login method
    if (req.admin.method === 'simple') {
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

module.exports = router;