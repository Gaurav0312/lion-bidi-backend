// routes/cartRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Product = require("../models/Product"); // assume you have this

// Middleware: require authentication
const requireAuth = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
};

/* ------------------- GET CART ------------------- */
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("cart.product");
    res.json({ cart: user.cart });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------- SAVE CART ------------------- */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { items } = req.body; // [{ productId, quantity }]
    const user = await User.findById(req.user._id);

    user.cart = items.map((item) => ({
      product: item._id || item.product,
      quantity: item.quantity,
    }));

    await user.save();
    const populatedUser = await User.findById(req.user._id).populate("cart.product");
    res.json({ cart: populatedUser.cart });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------- MERGE CART ------------------- */
router.post("/merge", requireAuth, async (req, res) => {
  try {
    const { items } = req.body; // guest cart
    const user = await User.findById(req.user._id);

    // Merge guest cart with existing cart
    items.forEach((guestItem) => {
      const existing = user.cart.find(
        (ci) => ci.product.toString() === guestItem._id
      );
      if (existing) {
        existing.quantity += guestItem.quantity || 1;
      } else {
        user.cart.push({
          product: guestItem._id,
          quantity: guestItem.quantity || 1,
        });
      }
    });

    await user.save();
    const populatedUser = await User.findById(req.user._id).populate("cart.product");
    res.json({ cart: populatedUser.cart });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
