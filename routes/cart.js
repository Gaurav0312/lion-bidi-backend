// routes/cart.js - Updated to handle both real and mock products
const express = require("express");
const User = require("../models/User");
const Product = require("../models/Product");
const auth = require("../middleware/auth");
const mongoose = require("mongoose");

const router = express.Router();

// -------------------- Add this helper function at the top --------------------
const findCartItem = (cart, productId) => {
  return cart.find((item) => {
    const itemProductId = item.productId ? item.productId.toString() : item.productId;
    const itemId = item._id ? item._id.toString() : null;
    const requestedId = productId.toString();
    
    // Match by productId OR _id
    return itemProductId === requestedId || itemId === requestedId;
  });
};

// Helper to validate if string is valid ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id);
};

// -------------------- Helpers --------------------
const validateProduct = async (productId, quantity, productData = null) => {
  // ✅ If complete product data is provided, use it directly (FIRST PRIORITY)
  if (productData && productData.name) {
    console.log("✅ Using provided product data:", productData.name);
    return {
      _id: productData._id || productId,
      productId: productId,
      name: productData.name,
      price: productData.price,
      discountPrice: productData.discountPrice || productData.price,
      image: productData.image,
      stock: productData.stock || 999,
    };
  }

  // ✅ Only check MongoDB if no product data provided
  if (isValidObjectId(productId)) {
    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found");
    if (product.stock < quantity) {
      throw new Error(`Only ${product.stock} items available in stock`);
    }
    return product;
  }

  // ✅ If neither product data nor valid ObjectId, throw error
  throw new Error(
    `Invalid product ID: ${productId}. Please provide valid product data.`
  );
};

const calculateTotals = (cart) => {
  let cartTotal = 0;
  let cartItemsCount = 0;

  cart.forEach((item) => {
    cartTotal += item.totalPrice || item.price * item.quantity;
    cartItemsCount += item.quantity;
  });

  return { cartTotal, cartItemsCount };
};

// -------------------- Get Cart --------------------
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const { cartTotal, cartItemsCount } = calculateTotals(user.cart);

    res.json({
      success: true,
      cart: user.cart,
      cartTotal,
      cartItemsCount,
    });
  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching cart",
      error: err.message,
    });
  }
});

// -------------------- Add to Cart --------------------
router.post("/add", auth, async (req, res) => {
  try {
    const { productId, quantity = 1, productData } = req.body;
    
    console.log("Add to cart request:", { productId, quantity, userID: req.user.id });

    if (!productId) return res.status(400).json({ success: false, message: "Product ID required" });
    if (quantity < 1) return res.status(400).json({ success: false, message: "Quantity must be at least 1" });

    const product = await validateProduct(productId, quantity, productData);
    console.log("Product validated:", product.name);

    const user = await User.findById(req.user.id);
    console.log("User found:", user.name);

    // ✅ Use the new helper function for consistent matching
    const existingItem = findCartItem(user.cart, productId);

    const unitPrice = product.discountPrice || product.price;

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      
      if (newQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add ${quantity} more. Only ${product.stock - existingItem.quantity} left`,
        });
      }

      existingItem.quantity = newQuantity;
      existingItem.totalPrice = unitPrice * newQuantity;
      existingItem.addedAt = new Date();
      console.log("✅ Updated existing cart item quantity to:", newQuantity);
    } else {
      user.cart.push({
        productId: productId,
        name: product.name,
        price: unitPrice,
        image: product.image || "/api/placeholder/150/150",
        quantity,
        totalPrice: unitPrice * quantity,
        addedAt: new Date(),
      });
      console.log("✅ Added new cart item");
    }

    await user.save();
    
    const { cartTotal, cartItemsCount } = calculateTotals(user.cart);
    
    res.json({
      success: true,
      message: `${product.name} ${existingItem ? 'quantity updated' : 'added to cart'}`,
      cart: user.cart,
      cartTotal,
      cartItemsCount
    });

  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Error adding to cart",
      error: err.message
    });
  }
});

// -------------------- Update Quantity --------------------
// -------------------- Update Quantity --------------------
router.put("/update/:productId", auth, async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    console.log(`Updating cart item ${productId} to quantity ${quantity}`);

    if (quantity < 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Quantity cannot be negative" 
      });
    }

    if (quantity === 0) {
      // If quantity is 0, remove the item
      return router.handle({ 
        method: 'DELETE', 
        url: `/remove/${productId}` 
      }, req, res);
    }

    const user = await User.findById(req.user.id);
    
    // Use the helper function to find cart item
    const cartItem = findCartItem(user.cart, productId);
    
    if (!cartItem) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not in cart" 
      });
    }

    // Update the cart item
    cartItem.quantity = quantity;
    cartItem.totalPrice = cartItem.price * quantity;
    cartItem.addedAt = new Date();

    // Save to MongoDB
    await user.save();
    console.log(`Cart item ${productId} updated successfully in MongoDB`);

    const { cartTotal, cartItemsCount } = calculateTotals(user.cart);

    res.json({
      success: true,
      message: "Cart updated successfully",
      cart: user.cart,
      cartTotal,
      cartItemsCount
    });

  } catch (err) {
    console.error("Update cart error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Error updating cart",
      error: err.message
    });
  }
});


// -------------------- Remove Item --------------------
router.delete("/remove/:productId", auth, async (req, res) => {
  try {
    const { productId } = req.params;
    console.log("Attempting to remove product ID:", productId); // Debug log

    const user = await User.findById(req.user.id);
    console.log("User cart before removal:", user.cart); // Debug log

    // Find the item first to debug
    const itemToRemove = user.cart.find((item) => {
      const itemId = item.productId
        ? item.productId.toString()
        : item.productId;
      console.log("Comparing:", itemId, "with", productId); // Debug log
      return itemId === productId.toString();
    });

    if (!itemToRemove) {
      console.log("Product not found in cart"); // Debug log
      return res.status(404).json({
        success: false,
        message: "Product not in cart",
        debug: {
          productId,
          cartItems: user.cart.map((item) => ({
            id: item.productId ? item.productId.toString() : item.productId,
            name: item.name,
          })),
        },
      });
    }

    // Remove the item
    const initialLength = user.cart.length;
    user.cart = user.cart.filter((item) => {
      const itemId = item.productId
        ? item.productId.toString()
        : item.productId;
      return itemId !== productId.toString();
    });

    await user.save();

    const { cartTotal, cartItemsCount } = calculateTotals(user.cart);

    console.log("Product removed successfully"); // Debug log

    res.json({
      success: true,
      message: "Product removed",
      cart: user.cart,
      cartTotal,
      cartItemsCount,
    });
  } catch (err) {
    console.error("Remove cart error:", err);
    res.status(500).json({
      success: false,
      message: "Error removing from cart",
      error: err.message,
    });
  }
});

// Add this helper function at the top of routescart.js
const isMatchingId = (cartItemId, requestedId) => {
  const id1 = cartItemId?.toString() || cartItemId;
  const id2 = requestedId?.toString() || requestedId;

  console.log(`Comparing cart ID: "${id1}" with requested ID: "${id2}"`);
  return id1 === id2;
};

// Update your remove route:
router.delete("/remove/:productId", auth, async (req, res) => {
  try {
    const { productId } = req.params;
    console.log("Attempting to remove product ID:", productId);

    const user = await User.findById(req.user.id);
    console.log(
      "User cart before removal:",
      user.cart.map((item) => ({
        productId: item.productId,
        _id: item._id,
        name: item.name,
      }))
    );

    // Try to match by both productId AND _id
    const itemToRemove = user.cart.find((item) => {
      return (
        isMatchingId(item.productId, productId) ||
        isMatchingId(item._id, productId)
      );
    });

    if (!itemToRemove) {
      console.log("❌ Product not found in cart");
      return res.status(404).json({
        success: false,
        message: "Product not in cart",
      });
    }

    console.log("✅ Found item to remove:", itemToRemove.name);

    // Remove the item (match by both IDs)
    user.cart = user.cart.filter((item) => {
      return !(
        isMatchingId(item.productId, productId) ||
        isMatchingId(item._id, productId)
      );
    });

    await user.save();

    const { cartTotal, cartItemsCount } = calculateTotals(user.cart);

    console.log("✅ Product removed successfully");

    res.json({
      success: true,
      message: "Product removed",
      cart: user.cart,
      cartTotal,
      cartItemsCount,
    });
  } catch (err) {
    console.error("Remove cart error:", err);
    res.status(500).json({
      success: false,
      message: "Error removing from cart",
      error: err.message,
    });
  }
});

// -------------------- Clear Cart --------------------
router.delete("/clear", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.cart = [];
    await user.save();

    res.json({
      success: true,
      message: "Cart cleared",
      cart: [],
      cartTotal: 0,
      cartItemsCount: 0,
    });
  } catch (err) {
    console.error("Clear cart error:", err);
    res.status(500).json({
      success: false,
      message: "Error clearing cart",
      error: err.message,
    });
  }
});

// -------------------- Merge Local Cart --------------------
router.post("/merge", auth, async (req, res) => {
  try {
    const { items = [] } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    console.log("Merging cart items:", items);

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        try {
          const productId = item._id || item.id || item.productId;
          console.log("Processing merge item:", productId);

          // Validate product (handles both real and mock)
          const product = await validateProduct(productId, item.quantity || 1);

          const existingCartItem = user.cart.find((cartItem) => {
            const cartItemId = cartItem.productId
              ? cartItem.productId.toString()
              : cartItem.productId;
            return cartItemId === productId.toString();
          });

          const unitPrice = product.discountPrice || product.price;
          const quantityToAdd = item.quantity || 1;

          if (existingCartItem) {
            // Update existing item
            const newQuantity = existingCartItem.quantity + quantityToAdd;
            existingCartItem.quantity = Math.min(newQuantity, product.stock);
            existingCartItem.price = unitPrice;
            existingCartItem.totalPrice = unitPrice * existingCartItem.quantity;
            existingCartItem.addedAt = new Date();
            console.log("Updated existing item in merge");
          } else {
            // Add new item
            user.cart.push({
              productId: productId,
              name: product.name,
              price: unitPrice,
              image: product.image || "/api/placeholder/150/150",
              quantity: Math.min(quantityToAdd, product.stock),
              totalPrice: unitPrice * Math.min(quantityToAdd, product.stock),
              addedAt: new Date(),
            });
            console.log("Added new item in merge");
          }
        } catch (itemError) {
          console.error(
            `Error processing merge item ${item._id || item.id}:`,
            itemError
          );
        }
      }

      await user.save();
      console.log("Cart merge completed and saved");
    }

    const { cartTotal, cartItemsCount } = calculateTotals(user.cart);

    res.json({
      success: true,
      message: "Cart merged successfully",
      cart: user.cart,
      cartTotal,
      cartItemsCount,
    });
  } catch (err) {
    console.error("Merge cart error:", err);
    res.status(500).json({
      success: false,
      message: "Error merging cart",
      error: err.message,
    });
  }
});

module.exports = router;
