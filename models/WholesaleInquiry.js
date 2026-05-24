const mongoose = require("mongoose");

const WholesaleInquirySchema = new mongoose.Schema({
  // Inquiry type: 'wholesale' or 'sample'
  inquiryType: {
    type: String,
    enum: ["wholesale", "sample"],
    required: true,
    default: "wholesale",
  },

  // Business details
  businessName: {
    type: String,
    required: true,
    trim: true,
  },
  contactPerson: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  city: {
    type: String,
    required: true,
    trim: true,
  },
  state: {
    type: String,
    trim: true,
  },
  businessType: {
    type: String,
    enum: ["retailer", "distributor", "wholesaler", "panwadi", "other"],
    default: "wholesaler",
  },
  gstNumber: {
    type: String,
    trim: true,
  },

  // Order details
  expectedMonthlyQuantity: {
    type: String,
    trim: true,
  },
  interestedProducts: {
    type: [String],
    default: [],
  },

  // Sample-specific fields
  sampleProducts: {
    type: [String],
    default: [],
  },
  shopAddress: {
    type: String,
    trim: true,
  },

  // General
  message: {
    type: String,
    trim: true,
  },

  // Admin tracking
  status: {
    type: String,
    enum: ["new", "contacted", "converted", "rejected"],
    default: "new",
  },
  adminNotes: {
    type: String,
    trim: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("WholesaleInquiry", WholesaleInquirySchema);
