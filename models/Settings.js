// models/Settings.js
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    default: 'admin',
    enum: ['admin', 'site', 'payment']
  },
  general: {
    siteName: {
      type: String,
      default: 'Lion Bidi'
    },
    siteEmail: {
      type: String,
      default: 'admin@lionbidi.com'
    },
    supportPhone: {
      type: String,
      default: '+91-9876543210'
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR']
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    }
  },
  notifications: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    orderNotifications: {
      type: Boolean,
      default: true
    },
    paymentNotifications: {
      type: Boolean,
      default: true
    },
    lowStockAlerts: {
      type: Boolean,
      default: true
    },
    dailyReports: {
      type: Boolean,
      default: false
    }
  },
  security: {
    twoFactorAuth: {
      type: Boolean,
      default: false
    },
    sessionTimeout: {
      type: Number,
      default: 60, // minutes
      min: 15,
      max: 480
    },
    passwordExpiry: {
      type: Number,
      default: 90, // days
      min: 30,
      max: 365
    },
    maxLoginAttempts: {
      type: Number,
      default: 5,
      min: 3,
      max: 10
    }
  },
  payment: {
    upiId: {
      type: String,
      trim: true
    },
    bankName: {
      type: String,
      trim: true
    },
    accountNumber: {
      type: String,
      trim: true
    },
    ifscCode: {
      type: String,
      trim: true,
      uppercase: true
    },
    enableUPI: {
      type: Boolean,
      default: true
    },
    enableBankTransfer: {
      type: Boolean,
      default: true
    }
  },
  updatedBy: {
    type: String, // Admin username or ID
    required: true
  }
}, {
  timestamps: true
});

// Index for faster queries
settingsSchema.index({ type: 1 });

// Method to get settings by type
settingsSchema.statics.getByType = function(type) {
  return this.findOne({ type });
};

// Method to update settings safely
settingsSchema.methods.updateSection = function(section, data) {
  if (this[section]) {
    Object.assign(this[section], data);
    this.markModified(section);
  }
  return this;
};

module.exports = mongoose.model('Settings', settingsSchema);