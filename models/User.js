//models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ================== Address Schema ==================
const addressSchema = new mongoose.Schema(
  {
    street: { type: String, required: [true, "Street is required"] },
    city: { type: String, required: [true, "City is required"] },
    state: { type: String, required: [true, "State is required"] },
    zipCode: { type: String, required: [true, "ZIP/Pin code is required"] },
    country: { type: String, default: "India" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

// ================== Cart Item Schema ==================
const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.Mixed, // Handles both ObjectId and string/number IDs
    required: true,
  },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  totalPrice: { type: Number, required: true },
  addedAt: { type: Date, default: Date.now },
});

// ================== Wishlist Item Schema (FIXED) ==================
const wishlistItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.Mixed, // Handles both ObjectId and string/number IDs
    required: true,
  },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number }, // For showing discounts
  image: { type: String, required: true },
  category: { type: String },
  brand: { type: String },
  addedAt: { type: Date, default: Date.now },
});

// ================== User Schema ==================
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
        "Please add a valid email",
      ],
    },
    password: {
      type: String,
      required: function () {
        return this.provider === "email";
      },
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    phone: {
      type: String,
      required: function () {
        return this.provider === "email";
      },
      unique: true,
      sparse: true,
      match: [/^[6-9]\d{9}$/, "Please add a valid Indian phone number"],
    },

    // Address (single + multiple support)
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: "India" },
    },
    addresses: [addressSchema],

    dateOfBirth: Date,

    // Role management
    isAdmin: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
    },

    // Profile
    avatar: { type: String, default: null },

    googleId: {
    type: String,
    unique: true,
    sparse: true // allows multiple null values
  },

    // Social Login Fields
    provider: {
      type: String,
      enum: ["email", "google", "facebook"],
      default: "email",
    },
    providerId: {
      type: String,
      sparse: true,
    },

    // Verification status
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },

    // E-commerce features - FIXED
    wishlist: [wishlistItemSchema], // ✅ Now uses the proper schema with full product details
    cart: [cartItemSchema],
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],

    // Security
    lastLogin: Date,
    isActive: { type: Boolean, default: true },

    // Tokens
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerificationToken: String,
    emailVerificationExpire: Date,
  },
  { timestamps: true }
);

// ================== Middleware ==================
userSchema.pre("save", async function (next) {
  // Keep role/isAdmin in sync
  if (this.isModified("isAdmin")) {
    this.role = this.isAdmin ? "admin" : "customer";
  } else if (this.isModified("role")) {
    this.isAdmin = this.role === "admin";
  }

  // Hash password if changed
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

// ================== Auth Methods ==================
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });
};

userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// ================== Cart Methods ==================
userSchema.methods.addOrUpdateCartItem = async function (productId, qty = 1, productData = null) {
  // Check if it's a valid ObjectId for real products
  const isValidObjectId = mongoose.Types.ObjectId.isValid(productId) && /^[0-9a-fA-F]{24}$/.test(productId);
  
  let product;
  if (productData && productData.name) {
    // Use provided product data
    product = productData;
  } else if (isValidObjectId) {
    // Real MongoDB product
    product = await mongoose.model("Product").findById(productId);
    if (!product) throw new Error("Product not found");
  } else {
    // Mock product - create temporary product object
    product = {
      _id: productId,
      name: `Mock Product ${productId}`,
      price: 100,
      discountPrice: 80,
      image: "/api/placeholder/150/150",
      stock: 999,
    };
  }

  const unitPrice = product.discountPrice || product.price;
  const maxQuantity = Math.min(qty, product.stock || 999);

  const existingItem = this.cart.find((item) => {
    const itemProductId = item.productId ? item.productId.toString() : item.productId;
    return itemProductId === productId.toString();
  });

  if (existingItem) {
    // Update quantity and totalPrice
    existingItem.quantity = Math.min(existingItem.quantity + maxQuantity, product.stock || 999);
    existingItem.price = unitPrice;
    existingItem.totalPrice = unitPrice * existingItem.quantity;
    existingItem.addedAt = new Date();
  } else {
    // Push new item snapshot
    this.cart.push({
      productId: productId,
      name: product.name,
      price: unitPrice,
      image: product.image,
      quantity: maxQuantity,
      totalPrice: unitPrice * maxQuantity,
      addedAt: new Date(),
    });
  }

  await this.save();
  return this.cart;
};

userSchema.methods.updateCartQuantity = function (productId, quantity) {
  if (quantity <= 0) return this.removeFromCart(productId);

  const item = this.cart.find((item) => {
    const itemProductId = item.productId ? item.productId.toString() : item.productId;
    return itemProductId === productId.toString();
  });
  
  if (!item) throw new Error("Product not found in cart");

  item.quantity = quantity;
  item.totalPrice = item.price * quantity;
  item.addedAt = new Date();
  return this.save();
};

userSchema.methods.removeFromCart = async function (productId) {
  this.cart = this.cart.filter((item) => {
    const itemProductId = item.productId ? item.productId.toString() : item.productId;
    return itemProductId !== productId.toString();
  });
  await this.save();
  return this.cart;
};

userSchema.methods.clearCart = async function () {
  this.cart = [];
  await this.save();
  return this.cart;
};

userSchema.methods.getCartItemsCount = function () {
  if (!this.cart || !Array.isArray(this.cart)) {
    return 0;
  }
  return this.cart.reduce((total, item) => total + (item.quantity || 0), 0);
};


userSchema.methods.getCartTotal = function () {
  return this.cart.reduce((total, item) => total + (item.totalPrice || 0), 0);
};

// ================== Wishlist Methods (FIXED) ==================
userSchema.methods.addToWishlist = async function (productId, productData = null) {
  // Check if already exists
  const alreadyExists = this.wishlist.some((item) => {
    const itemProductId = item.productId ? item.productId.toString() : item.productId;
    return itemProductId === productId.toString();
  });
  
  if (alreadyExists) {
    throw new Error("Product already in wishlist");
  }

  // Get product data
  const isValidObjectId = mongoose.Types.ObjectId.isValid(productId) && /^[0-9a-fA-F]{24}$/.test(productId);
  
  let product;
  if (productData && productData.name) {
    product = productData;
  } else if (isValidObjectId) {
    product = await mongoose.model("Product").findById(productId);
    if (!product) throw new Error("Product not found");
  } else {
    product = {
      _id: productId,
      name: `Mock Product ${productId}`,
      price: 100,
      discountPrice: 80,
      image: "/api/placeholder/150/150",
      category: "General",
      brand: "Generic",
    };
  }

  // Add to wishlist with full details
  this.wishlist.push({
    productId: productId,
    name: product.name,
    price: product.discountPrice || product.price,
    originalPrice: product.price,
    image: product.image || "/api/placeholder/150/150",
    category: product.category,
    brand: product.brand,
    addedAt: new Date(),
  });

  await this.save();
  return this.wishlist;
};

userSchema.methods.removeFromWishlist = async function (productId) {
  this.wishlist = this.wishlist.filter((item) => {
    const itemProductId = item.productId ? item.productId.toString() : item.productId;
    return itemProductId !== productId.toString();
  });
  await this.save();
  return this.wishlist;
};

userSchema.methods.toggleWishlist = async function (productId, productData = null) {
  const isInWishlist = this.wishlist.some((item) => {
    const itemProductId = item.productId ? item.productId.toString() : item.productId;
    return itemProductId === productId.toString();
  });

  return isInWishlist
    ? this.removeFromWishlist(productId)
    : this.addToWishlist(productId, productData);
};

userSchema.methods.isInWishlist = function (productId) {
  return this.wishlist.some((item) => {
    const itemProductId = item.productId ? item.productId.toString() : item.productId;
    return itemProductId === productId.toString();
  });
};

userSchema.methods.clearWishlist = async function () {
  this.wishlist = [];
  await this.save();
  return this.wishlist;
};

// ================== Cart Summary Method ==================
userSchema.methods.getCartSummary = function () {
  let subtotal = 0;
  let totalQuantity = 0;

  const cartSummary = this.cart.map((item) => {
    subtotal += item.totalPrice || 0;
    totalQuantity += item.quantity || 0;

    return {
      productId: item.productId,
      name: item.name,
      price: item.price,
      image: item.image,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
    };
  });

  // Bulk discount tiers
  let bulkDiscountPercent = 0;
  if (totalQuantity >= 50) bulkDiscountPercent = 20;
  else if (totalQuantity >= 20) bulkDiscountPercent = 15;
  else if (totalQuantity >= 10) bulkDiscountPercent = 10;
  else if (totalQuantity >= 5) bulkDiscountPercent = 5;

  const bulkDiscount = (subtotal * bulkDiscountPercent) / 100;
  const finalTotal = Math.max(0, subtotal - bulkDiscount);

  return {
    cartSummary,
    pricing: {
      subtotal,
      bulkDiscountPercent,
      bulkDiscount,
      totalSavings: bulkDiscount,
      finalTotal,
      totalQuantity,
    },
  };
};

// ================== Virtuals ==================
userSchema.virtual("cartCount").get(function () {
  return this.getCartItemsCount();
});

userSchema.virtual("wishlistCount").get(function () {
  return this.wishlist?.length || 0;
});

userSchema.set("toJSON", { virtuals: true });

// ================== Indexes ==================
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ "cart.productId": 1 });
userSchema.index({ "wishlist.productId": 1 }); // ✅ Added wishlist index
userSchema.index({ provider: 1, providerId: 1 });

const User = mongoose.model("User", userSchema);
module.exports = User;
