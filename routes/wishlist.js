// routes/wishlist.js - Wishlist functionality with MongoDB integration
const express = require("express");
const User = require("../models/User");
const Product = require("../models/Product");
const auth = require("../middleware/auth");
const mongoose = require("mongoose");

const router = express.Router();

// -------------------- Helper Functions --------------------
const findWishlistItem = (wishlist, productId) => {
  return wishlist.find((item) => {
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

const validateProduct = async (productId, productData = null) => {
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
      category: productData.category,
      brand: productData.brand,
    };
  }

  // ✅ Only check MongoDB if no product data provided
  if (isValidObjectId(productId)) {
    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found");
    return product;
  }

  // ✅ If neither product data nor valid ObjectId, throw error
  throw new Error(
    `Invalid product ID: ${productId}. Please provide valid product data.`
  );
};

const isMatchingId = (wishlistItemId, requestedId) => {
  const id1 = wishlistItemId?.toString() || wishlistItemId;
  const id2 = requestedId?.toString() || requestedId;

  console.log(`Comparing wishlist ID: "${id1}" with requested ID: "${id2}"`);
  return id1 === id2;
};

// -------------------- Get Wishlist --------------------
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const wishlistItemsCount = user.wishlist ? user.wishlist.length : 0;

    res.json({
      success: true,
      wishlist: user.wishlist || [],
      wishlistItemsCount,
    });
  } catch (err) {
    console.error("Get wishlist error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching wishlist",
      error: err.message,
    });
  }
});

// -------------------- Add to Wishlist --------------------
router.post("/add", auth, async (req, res) => {
  try {
    const { productId, productData } = req.body;
    
    console.log("Add to wishlist request:", { productId, userID: req.user.id });

    if (!productId) return res.status(400).json({ success: false, message: "Product ID required" });

    const product = await validateProduct(productId, productData);
    console.log("Product validated:", product.name);

    const user = await User.findById(req.user.id);
    console.log("User found:", user.name);

    // Initialize wishlist if it doesn't exist
    if (!user.wishlist) {
      user.wishlist = [];
    }

    // ✅ Use the helper function for consistent matching
    const existingItem = findWishlistItem(user.wishlist, productId);

    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: `${product.name} is already in your wishlist`,
      });
    }

    // Add new item to wishlist
    user.wishlist.push({
      productId: productId,
      name: product.name,
      price: product.discountPrice || product.price,
      originalPrice: product.price,
      image: product.image || "/api/placeholder/150/150",
      category: product.category,
      brand: product.brand,
      addedAt: new Date(),
    });

    console.log("✅ Added new wishlist item");

    await user.save();
    
    const wishlistItemsCount = user.wishlist.length;
    
    res.json({
      success: true,
      message: `${product.name} added to wishlist`,
      wishlist: user.wishlist,
      wishlistItemsCount
    });

  } catch (err) {
    console.error("Add to wishlist error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Error adding to wishlist",
      error: err.message
    });
  }
});

// -------------------- Remove from Wishlist --------------------
router.delete("/remove/:productId", auth, async (req, res) => {
  try {
    const { productId } = req.params;
    console.log("Attempting to remove product ID from wishlist:", productId);

    const user = await User.findById(req.user.id);
    
    if (!user.wishlist) {
      user.wishlist = [];
    }

    console.log(
      "User wishlist before removal:",
      user.wishlist.map((item) => ({
        productId: item.productId,
        _id: item._id,
        name: item.name,
      }))
    );

    // Try to match by both productId AND _id
    const itemToRemove = user.wishlist.find((item) => {
      return (
        isMatchingId(item.productId, productId) ||
        isMatchingId(item._id, productId)
      );
    });

    if (!itemToRemove) {
      console.log("❌ Product not found in wishlist");
      return res.status(404).json({
        success: false,
        message: "Product not in wishlist",
      });
    }

    console.log("✅ Found item to remove from wishlist:", itemToRemove.name);

    // Remove the item (match by both IDs)
    user.wishlist = user.wishlist.filter((item) => {
      return !(
        isMatchingId(item.productId, productId) ||
        isMatchingId(item._id, productId)
      );
    });

    await user.save();

    const wishlistItemsCount = user.wishlist.length;

    console.log("✅ Product removed from wishlist successfully");

    res.json({
      success: true,
      message: `${itemToRemove.name} removed from wishlist`,
      wishlist: user.wishlist,
      wishlistItemsCount,
    });
  } catch (err) {
    console.error("Remove wishlist error:", err);
    res.status(500).json({
      success: false,
      message: "Error removing from wishlist",
      error: err.message,
    });
  }
});

// -------------------- Toggle Wishlist (Add/Remove) --------------------
router.post("/toggle", auth, async (req, res) => {
  try {
    const { productId, productData } = req.body;
    
    console.log("Toggle wishlist request:", { productId, userID: req.user.id });

    if (!productId) return res.status(400).json({ success: false, message: "Product ID required" });

    const user = await User.findById(req.user.id);
    
    // Initialize wishlist if it doesn't exist
    if (!user.wishlist) {
      user.wishlist = [];
    }

    // Check if product exists in wishlist
    const existingItem = findWishlistItem(user.wishlist, productId);

    if (existingItem) {
      // Remove from wishlist
      user.wishlist = user.wishlist.filter((item) => {
        return !(
          isMatchingId(item.productId, productId) ||
          isMatchingId(item._id, productId)
        );
      });

      await user.save();

      res.json({
        success: true,
        message: `${existingItem.name} removed from wishlist`,
        wishlist: user.wishlist,
        wishlistItemsCount: user.wishlist.length,
        action: 'removed'
      });
    } else {
      // Add to wishlist
      const product = await validateProduct(productId, productData);

      user.wishlist.push({
        productId: productId,
        name: product.name,
        price: product.discountPrice || product.price,
        originalPrice: product.price,
        image: product.image || "/api/placeholder/150/150",
        category: product.category,
        brand: product.brand,
        addedAt: new Date(),
      });

      await user.save();

      res.json({
        success: true,
        message: `${product.name} added to wishlist`,
        wishlist: user.wishlist,
        wishlistItemsCount: user.wishlist.length,
        action: 'added'
      });
    }

  } catch (err) {
    console.error("Toggle wishlist error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Error toggling wishlist",
      error: err.message
    });
  }
});

// -------------------- Clear Wishlist --------------------
router.delete("/clear", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.wishlist = [];
    await user.save();

    res.json({
      success: true,
      message: "Wishlist cleared",
      wishlist: [],
      wishlistItemsCount: 0,
    });
  } catch (err) {
    console.error("Clear wishlist error:", err);
    res.status(500).json({
      success: false,
      message: "Error clearing wishlist",
      error: err.message,
    });
  }
});

// -------------------- Merge Local Wishlist --------------------
router.post("/merge", auth, async (req, res) => {
  try {
    const { items = [] } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Initialize wishlist if it doesn't exist
    if (!user.wishlist) {
      user.wishlist = [];
    }

    console.log("Merging wishlist items:", items);

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        try {
          const productId = item._id || item.id || item.productId;
          console.log("Processing merge item:", productId);

          // Check if item already exists in wishlist
          const existingWishlistItem = user.wishlist.find((wishlistItem) => {
            const wishlistItemId = wishlistItem.productId
              ? wishlistItem.productId.toString()
              : wishlistItem.productId;
            return wishlistItemId === productId.toString();
          });

          if (!existingWishlistItem) {
            // Validate product (handles both real and mock)
            const product = await validateProduct(productId, item);

            // Add new item to wishlist
            user.wishlist.push({
              productId: productId,
              name: product.name,
              price: product.discountPrice || product.price,
              originalPrice: product.price,
              image: product.image || "/api/placeholder/150/150",
              category: product.category,
              brand: product.brand,
              addedAt: new Date(),
            });
            console.log("Added new item in wishlist merge");
          } else {
            console.log("Item already exists in wishlist, skipping");
          }
        } catch (itemError) {
          console.error(
            `Error processing merge item ${item._id || item.id}:`,
            itemError
          );
        }
      }

      await user.save();
      console.log("Wishlist merge completed and saved");
    }

    const wishlistItemsCount = user.wishlist.length;

    res.json({
      success: true,
      message: "Wishlist merged successfully",
      wishlist: user.wishlist,
      wishlistItemsCount,
    });
  } catch (err) {
    console.error("Merge wishlist error:", err);
    res.status(500).json({
      success: false,
      message: "Error merging wishlist",
      error: err.message,
    });
  }
});

// -------------------- Check if Product is in Wishlist --------------------
router.get("/check/:productId", auth, async (req, res) => {
  try {
    const { productId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user.wishlist) {
      user.wishlist = [];
    }

    const isInWishlist = findWishlistItem(user.wishlist, productId) !== undefined;

    res.json({
      success: true,
      isInWishlist,
      productId
    });
  } catch (err) {
    console.error("Check wishlist error:", err);
    res.status(500).json({
      success: false,
      message: "Error checking wishlist",
      error: err.message,
    });
  }
});

module.exports = router;
