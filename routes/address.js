// routes/address.js - Complete corrected version for MongoDB
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");

// @desc    Save/Update user primary address  
// @route   POST /api/address/save
// @access  Private
router.post("/save", auth, async (req, res) => {
  try {
    console.log("🏠 Address save request:", {
      userId: req.user._id,
      addressData: req.body,
    });

    const {
      name,
      mobileNumber, 
      emailAddress,
      address,
      locality,
      landmark,
      pinCode,
      city,
      state,
    } = req.body;

    // Validation
    if (!name || !mobileNumber || !emailAddress || !address || !pinCode || !city || !state) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields",
      });
    }

    // Validate mobile number format
    if (!/^\d{10}$/.test(mobileNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit mobile number'
      });
    }

    // Validate email format
    if (!/\S+@\S+\.\S+/.test(emailAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Validate pin code format
    if (!/^\d{6}$/.test(pinCode)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-digit pin code'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Build complete street address
    const fullStreetAddress = `${address}${locality ? ", " + locality : ""}${landmark ? ", " + landmark : ""}`;

    // Update user's primary address
    user.address = {
      street: fullStreetAddress,
      city,
      state,
      zipCode: pinCode,
      country: "India",
    };

    // Update user info
    user.name = name;
    user.phone = mobileNumber;
    user.email = emailAddress;

    // Initialize addresses array if it doesn't exist
    if (!user.addresses) {
      user.addresses = [];
    }

    await user.save();

    console.log("✅ Primary address saved successfully for user:", user.name);

    res.status(200).json({
      success: true,
      message: "Address saved successfully",
      address: user.address,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
      },
    });
  } catch (error) {
    console.error("❌ Error saving address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save address",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @desc    Get user address and all addresses
// @route   GET /api/address
// @access  Private  
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "name email phone address addresses"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Ensure addresses array exists
    if (!user.addresses) {
      user.addresses = [];
    }

    res.status(200).json({
      success: true,
      address: user.address, // Primary address
      addresses: user.addresses, // All secondary addresses
      userInfo: {
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch address",
    });
  }
});

// @desc    Add new secondary address
// @route   POST /api/address/add
// @access  Private
router.post("/add", auth, async (req, res) => {
  try {
    const { street, city, state, zipCode, isDefault = false } = req.body;

    if (!street || !city || !state || !zipCode) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields",
      });
    }

    // Validate pin code format
    if (!/^\d{6}$/.test(zipCode)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-digit pin code'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Initialize addresses array if it doesn't exist
    if (!user.addresses) {
      user.addresses = [];
    }

    // Add new secondary address
    user.addresses.push({
      street,
      city,
      state,
      zipCode,
      country: "India",
      isDefault: false, // Secondary addresses are never default
    });

    await user.save();

    console.log("✅ Secondary address added successfully for user:", user.name);

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      addresses: user.addresses,
      address: user.address,
    });
  } catch (error) {
    console.error("❌ Error adding address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add address",
    });
  }
});

// @desc    Update address
// @route   PUT /api/address/:id  
// @access  Private
router.put("/:id", auth, async (req, res) => {
  try {
    const { street, city, state, zipCode } = req.body;

    // Validate pin code format if provided
    if (zipCode && !/^\d{6}$/.test(zipCode)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-digit pin code'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Handle primary address update
    if (req.params.id === 'primary') {
      if (street !== undefined) user.address.street = street;
      if (city !== undefined) user.address.city = city;
      if (state !== undefined) user.address.state = state;
      if (zipCode !== undefined) user.address.zipCode = zipCode;
      
      await user.save();
      
      console.log("✅ Primary address updated successfully for user:", user.name);
      
      return res.status(200).json({
        success: true,
        message: "Primary address updated successfully",
        address: user.address,
        addresses: user.addresses,
      });
    }

    // Handle secondary address update
    const address = user.addresses.id(req.params.id);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Update address fields
    if (street !== undefined) address.street = street;
    if (city !== undefined) address.city = city;
    if (state !== undefined) address.state = state;
    if (zipCode !== undefined) address.zipCode = zipCode;

    await user.save();

    console.log("✅ Secondary address updated successfully for user:", user.name);

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      addresses: user.addresses,
      address: user.address,
    });
  } catch (error) {
    console.error("❌ Error updating address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update address",
    });
  }
});

// @desc    Delete secondary address
// @route   DELETE /api/address/:id
// @access  Private
router.delete("/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Don't allow deletion of primary address
    if (req.params.id === 'primary') {
      return res.status(400).json({
        success: false,
        message: "Cannot delete primary address",
      });
    }

    const address = user.addresses.id(req.params.id);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Remove the address using pull method (correct approach)
    user.addresses.pull({ _id: req.params.id });
    await user.save();

    console.log("✅ Secondary address deleted successfully for user:", user.name);

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
      addresses: user.addresses,
    });
  } catch (error) {
    console.error("❌ Error deleting address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete address",
    });
  }
});

// @desc    Set secondary address as primary
// @route   PATCH /api/address/:id/default
// @access  Private
router.patch("/:id/default", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Handle setting primary address as default (it already is)
    if (req.params.id === 'primary') {
      return res.status(200).json({
        success: true,
        message: "Primary address is already the default",
        address: user.address,
        addresses: user.addresses,
      });
    }

    const address = user.addresses.id(req.params.id);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Copy secondary address to primary address
    user.address = {
      street: address.street,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country || "India",
    };

    // Remove the secondary address since it's now the primary
    user.addresses.pull({ _id: req.params.id });
    await user.save();

    console.log("✅ Address set as primary successfully for user:", user.name);

    res.status(200).json({
      success: true,
      message: "Address set as primary successfully",
      address: user.address,
      addresses: user.addresses,
    });
  } catch (error) {
    console.error("❌ Error setting primary address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set primary address",
    });
  }
});

module.exports = router;