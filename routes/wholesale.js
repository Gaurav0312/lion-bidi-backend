const express = require("express");
const router = express.Router();
const WholesaleInquiry = require("../models/WholesaleInquiry");

// POST /api/wholesale — Save wholesale inquiry
router.post("/", async (req, res) => {
  try {
    const {
      businessName,
      contactPerson,
      phone,
      email,
      city,
      state,
      businessType,
      gstNumber,
      expectedMonthlyQuantity,
      interestedProducts,
      message,
    } = req.body;

    // Validation
    if (!businessName || !contactPerson || !phone || !email || !city) {
      return res.status(400).json({
        success: false,
        msg: "Business name, contact person, phone, email, and city are required",
      });
    }

    // Save to DB
    const inquiry = new WholesaleInquiry({
      inquiryType: "wholesale",
      businessName,
      contactPerson,
      phone,
      email,
      city,
      state,
      businessType,
      gstNumber,
      expectedMonthlyQuantity,
      interestedProducts,
      message,
    });

    await inquiry.save();

    res.status(201).json({
      success: true,
      msg: "Wholesale inquiry submitted successfully",
      data: inquiry,
    });
  } catch (error) {
    console.error("❌ Error saving wholesale inquiry:", error);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

// POST /api/wholesale/sample — Save sample request
router.post("/sample", async (req, res) => {
  try {
    const {
      businessName,
      contactPerson,
      phone,
      email,
      city,
      state,
      businessType,
      shopAddress,
      sampleProducts,
      expectedMonthlyQuantity,
      message,
    } = req.body;

    // Validation
    if (!businessName || !contactPerson || !phone || !email || !city || !shopAddress) {
      return res.status(400).json({
        success: false,
        msg: "Business name, contact person, phone, email, city, and shop address are required",
      });
    }

    // Save to DB
    const sampleRequest = new WholesaleInquiry({
      inquiryType: "sample",
      businessName,
      contactPerson,
      phone,
      email,
      city,
      state,
      businessType,
      shopAddress,
      sampleProducts,
      expectedMonthlyQuantity,
      message,
    });

    await sampleRequest.save();

    res.status(201).json({
      success: true,
      msg: "Sample request submitted successfully",
      data: sampleRequest,
    });
  } catch (error) {
    console.error("❌ Error saving sample request:", error);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

module.exports = router;
