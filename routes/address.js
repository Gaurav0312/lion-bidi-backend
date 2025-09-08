// routes/address.js - Corrected version
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth"); // Use your auth middleware

// @desc    Save/Update user address
// @route   POST /api/address/save
// @access  Private
router.post("/save", auth, async (req, res) => {
  try {
    console.log("📍 Address save request:", {
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
    if (
      !name ||
      !mobileNumber ||
      !emailAddress ||
      !address ||
      !pinCode ||
      !city ||
      !state
    ) {
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

    // Update user's primary address
    user.address = {
      street: `${address}${locality ? ", " + locality : ""}${
        landmark ? ", " + landmark : ""
      }`,
      city,
      state,
      zipCode: pinCode,
      country: "India",
    };

    // Also update user info
    user.name = name;
    user.phone = mobileNumber;
    user.email = emailAddress;

    await user.save();

    console.log("✅ Address saved successfully for user:", user.name);

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

// @desc    Get user address
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

    res.status(200).json({
      success: true,
      address: user.address,
      addresses: user.addresses,
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

// @desc    Add new address
// @route   POST /api/address/add
// @access  Private
router.post("/add", auth, async (req, res) => {
  try {
    const { street, city, state, zipCode, isDefault } = req.body;

    if (!street || !city || !state || !zipCode) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // If this is set as default, remove default from others
    if (isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    user.addresses.push({
      street,
      city,
      state,
      zipCode,
      country: "India",
      isDefault: isDefault || user.addresses.length === 0,
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      addresses: user.addresses,
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
    const { street, city, state, zipCode, isDefault } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const address = user.addresses.id(req.params.id);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // If this is set as default, remove default from others
    if (isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    // Update address fields
    if (street !== undefined) address.street = street;
    if (city !== undefined) address.city = city;
    if (state !== undefined) address.state = state;
    if (zipCode !== undefined) address.zipCode = zipCode;
    if (isDefault !== undefined) address.isDefault = isDefault;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      addresses: user.addresses,
    });
  } catch (error) {
    console.error("❌ Error updating address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update address",
    });
  }
});

// @desc    Delete address
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

    const address = user.addresses.id(req.params.id);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Remove the address
    address.remove();
    await user.save();

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

module.exports = router;