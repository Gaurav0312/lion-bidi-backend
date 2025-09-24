//routes/orders.js
const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const User = require("../models/User");
const auth = require("../middleware/auth");
const adminAuth = require("../middleware/adminAuth");
const { sendOrderNotificationEmail } = require("../utils/emailService");
const nodemailer = require("nodemailer");

// Get pending payment verifications (Admin only)
router.get("/admin/pending-verifications", adminAuth, async (req, res) => {
  try {
    console.log("✅ Admin requesting pending verifications");

    const pendingOrders = await Order.find({
      "payment.paymentStatus": "pending_verification",
    })
      .populate("userId", "name email phone") // Populate user data
      .sort({ "payment.submittedAt": -1 });

    console.log(`📊 Found ${pendingOrders.length} pending verifications`);

    // Transform the data to match frontend expectations
    const transformedOrders = pendingOrders.map((order) => ({
      ...order.toObject(),
      user: order.userId, // ✅ Map userId to user for frontend compatibility
      orderNumber: order.orderNumber,
      orderDate: order.orderDate || order.createdAt,
    }));

    res.json({
      success: true,
      orders: transformedOrders,
    });
  } catch (error) {
    console.error("❌ Error fetching pending verifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending verifications",
      error: error.message,
    });
  }
});

// @desc    Get single order details (Admin version)
// @route   GET /api/orders/:orderId/admin
// @access  Private (Admin only)
router.get("/:orderId/admin", adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate("userId", "name email phone"); // Populate user data for admin

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Transform the data to match frontend expectations
    const transformedOrder = {
      ...order.toObject(),
      user: order.userId, // Map userId to user for frontend compatibility
    };

    res.json({
      success: true,
      order: transformedOrder,
    });
  } catch (error) {
    console.error("❌ Error fetching order (admin):", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
});


// @desc    Create new order from cart/checkout
// @route   POST /api/orders/create
// @access  Private
router.post("/create", auth, async (req, res) => {
  try {
    console.log("📦 Creating new order for user:", req.user._id);
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const { cartData, shippingAddress, paymentMethod = "UPI" } = req.body;

    // Enhanced validation
    if (!cartData) {
      return res.status(400).json({
        success: false,
        message: "Cart data is required",
      });
    }

    if (
      !cartData.items ||
      !Array.isArray(cartData.items) ||
      cartData.items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Cart must contain at least one item",
      });
    }

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required",
      });
    }

    // Validate shipping address fields
    const requiredAddressFields = [
      "name",
      "phone",
      "email",
      "street",
      "city",
      "state",
      "zipCode",
    ];
    for (const field of requiredAddressFields) {
      if (
        !shippingAddress[field] ||
        shippingAddress[field].toString().trim() === ""
      ) {
        return res.status(400).json({
          success: false,
          message: `Shipping address ${field} is required`,
        });
      }
    }

    // Validate and sanitize cart items
    const processedItems = cartData.items.map((item, index) => {
      if (!item.name || !item.price || !item.quantity) {
        throw new Error(
          `Item at index ${index} is missing required fields (name, price, quantity)`
        );
      }

      const price = parseFloat(item.price);
      const quantity = parseInt(item.quantity);

      if (isNaN(price) || price <= 0) {
        throw new Error(`Invalid price for item: ${item.name}`);
      }

      if (isNaN(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for item: ${item.name}`);
      }

      return {
        productId: item.id || item._id || null,
        name: item.name.toString().trim(),
        price: price,
        quantity: quantity,
        image: item.image || null,
        totalPrice: price * quantity,
      };
    });

    // Calculate totals
    const calculatedSubtotal = processedItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );
    const providedTotal = parseFloat(cartData.total) || calculatedSubtotal;
    const discount =
      parseFloat(cartData.savings) || parseFloat(cartData.discount) || 0;

    // Validate totals
    if (providedTotal <= 0) {
      return res.status(400).json({
        success: false,
        message: "Order total must be greater than 0",
      });
    }

    // Create order data
    const orderData = {
      userId: req.user._id,
      items: processedItems,
      subtotal: calculatedSubtotal,
      discount: discount,
      total: providedTotal,
      orderNumber: `LB${Date.now()}${Math.floor(Math.random() * 1000)}`,
      orderDate: new Date(),
      shippingAddress: {
        name: shippingAddress.name.toString().trim(),
        phone: shippingAddress.phone.toString().trim(),
        email: shippingAddress.email.toString().trim(),
        street: shippingAddress.street.toString().trim(),
        city: shippingAddress.city.toString().trim(),
        state: shippingAddress.state.toString().trim(),
        zipCode: shippingAddress.zipCode.toString().trim(),
        country: shippingAddress.country || "India",
      },
      payment: {
        method: paymentMethod,
        amount: providedTotal,
        paymentStatus: "pending",
      },
      status: "pending",
    };

    console.log("Processed order data:", JSON.stringify(orderData, null, 2));

    // Create order
    const order = await Order.create(orderData);
    console.log("Order created successfully in database:", order._id);

    // Add order to user's orders array (optional, handle gracefully if fails)
    try {
      const user = await User.findById(req.user._id);
      if (user && Array.isArray(user.orders)) {
        user.orders.push(order._id);
        await user.save();
        console.log("Order added to user's orders array");
      }
    } catch (userUpdateError) {
      console.log(
        "Note: Could not update user orders array:",
        userUpdateError.message
      );
      // Don't fail the order creation if user update fails
    }

    try {
      const { sendOrderNotificationEmail } = require("../utils/emailService");

      // Send admin notification email
      await sendOrderNotificationEmail(
        process.env.ADMIN_EMAIL || process.env.EMAIL_USER, // Admin email
        "admin_new_order",
        {
          orderNumber: order.orderNumber,
          customerName: order.shippingAddress.name,
          customerEmail: order.shippingAddress.email,
          amount: order.total,
          transactionId: "Pending verification",
          orderDate: order.orderDate || order.createdAt,
          items: order.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
        }
      );
      console.log("✅ Admin notification email sent successfully");
    } catch (emailError) {
      console.error(
        "❌ Failed to send admin notification email:",
        emailError.message
      );
      // Don't fail the order creation if email fails
    }

    console.log("✅ Order created successfully:", order.orderNumber);

    // Return success response
    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        subtotal: order.subtotal,
        discount: order.discount,
        status: order.status,
        orderDate: order.orderDate || order.createdAt,
        items: order.items,
        shippingAddress: order.shippingAddress,
        payment: {
          method: order.payment.method,
          amount: order.payment.amount,
          paymentStatus: order.payment.paymentStatus,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error creating order:", error);

    // Handle validation errors specifically
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        success: false,
        message: "Order validation failed",
        errors: validationErrors,
      });
    }

    // Handle custom thrown errors
    if (
      error.message.includes("Invalid") ||
      error.message.includes("required")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate order detected. Please try again.",
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: "Failed to create order. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @desc    Delete order (only for pending, cancelled, or payment_failed orders)
// @route   DELETE /api/orders/:orderId
// @access  Private
router.delete("/:orderId", auth, async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log("🗑️ Delete order request:", {
      orderId,
      userId: req.user._id,
    });

    // Find the order and verify it exists
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify order belongs to authenticated user
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only delete your own orders.",
      });
    }

    // Define which order statuses can be deleted
    const deletableStatuses = ["pending", "payment_failed", "cancelled"];

    if (!deletableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete order with status '${order.status}'. Only orders with status 'pending', 'payment_failed', or 'cancelled' can be deleted.`,
      });
    }

    // Additional check for payment status
    if (
      order.payment &&
      ["verified", "pending_verification"].includes(order.payment.paymentStatus)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete order with verified or pending verification payment status.",
      });
    }

    // Store order details for logging before deletion
    const orderNumber = order.orderNumber;
    const customerName = order.shippingAddress?.name || "Unknown";

    // Delete the order
    await Order.findByIdAndDelete(orderId);

    // Optional: Remove order from user's orders array if you maintain one
    try {
      const user = await User.findById(req.user._id);
      if (user && Array.isArray(user.orders)) {
        user.orders = user.orders.filter((id) => id.toString() !== orderId);
        await user.save();
        console.log("Order removed from user's orders array");
      }
    } catch (userUpdateError) {
      console.log(
        "Note: Could not update user orders array:",
        userUpdateError.message
      );
      // Don't fail the deletion if user update fails
    }

    // Optional: Send admin notification about deleted order
    try {
      if (
        process.env.ADMIN_EMAIL &&
        typeof sendOrderNotificationEmail === "function"
      ) {
        await sendOrderNotificationEmail(
          process.env.ADMIN_EMAIL,
          "admin_order_deleted",
          {
            orderNumber: orderNumber,
            customerName: customerName,
            customerEmail: req.user.email || "Unknown",
            deletedAt: new Date(),
            deletedBy: req.user._id,
          }
        );
        console.log("Admin notification sent for deleted order");
      }
    } catch (emailError) {
      console.log(
        "Note: Could not send admin notification for deletion:",
        emailError.message
      );
      // Don't fail the deletion if email fails
    }

    console.log(
      `✅ Order deleted successfully: ${orderNumber} by user ${req.user._id}`
    );

    res.json({
      success: true,
      message: "Order deleted successfully",
      deletedOrder: {
        id: orderId,
        orderNumber: orderNumber,
      },
    });
  } catch (error) {
    console.error("❌ Error deleting order:", error);

    // Handle specific MongoDB errors
    if (error.name === "CastError" && error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete order. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @desc    Get all orders (Admin only) - ADD THIS ROUTE
// @route   GET /api/orders/admin/all
// @access  Private (Admin only)
router.get("/admin/all", adminAuth, async (req, res) => {
  try {
    console.log("✅ Admin requesting all orders");

    const { page = 1, limit = 50, status, search } = req.query;
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .populate("userId", "name email phone") // ✅ Fixed: populate userId, not user
      .sort({ orderDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    console.log(`📊 Found ${orders.length} orders`);

    // Transform the data to match frontend expectations
    const transformedOrders = orders.map((order) => ({
      ...order.toObject(),
      user: order.userId, // ✅ Map userId to user for frontend compatibility
      orderNumber: order.orderNumber,
      orderDate: order.orderDate || order.createdAt,
    }));

    res.json({
      success: true,
      orders: transformedOrders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(await Order.countDocuments(query) / limit),
        total: await Order.countDocuments(query)
      }
    });
  } catch (error) {
    console.error("❌ Error fetching all orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
});

// @desc    Confirm payment and update order status
// @route   POST /api/orders/:orderId/confirm-payment
// @access  Private
router.post("/:orderId/confirm-payment", auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { transactionId, screenshot, upiId } = req.body;

    console.log("💰 Payment confirmation request:", {
      orderId,
      transactionId: transactionId ? "***" : "none",
    });

    // Validate required fields
    if (!transactionId || !transactionId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required",
      });
    }

    // Enhanced UPI Transaction ID validation
    const cleanTransactionId = transactionId.trim().toUpperCase();

    const upiTransactionPatterns = [
      /^\d{12}$/, // 12 digits only
      /^[A-Z0-9]{12}$/, // 12 alphanumeric
      /^\d{10,16}$/, // 10-16 digits
      /^[A-Z0-9]{10,16}$/, // 10-16 alphanumeric
      /^[A-Z]{2}\d{10,14}$/, // 2 letters followed by 10-14 digits
    ];

    const isValidFormat = upiTransactionPatterns.some((pattern) =>
      pattern.test(cleanTransactionId)
    );

    if (!isValidFormat) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid UPI transaction ID format. Please enter a valid 12-digit UPI transaction ID.",
      });
    }

    // Find the order and verify ownership
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify order belongs to authenticated user
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied. This order does not belong to you.",
      });
    }

    // Check if payment is already submitted/verified
    if (
      ["pending_verification", "verified", "completed"].includes(
        order.payment?.paymentStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment for this order has already been submitted",
      });
    }

    // Check if transaction ID already used (if you have this method)
    try {
      if (typeof Order.isTransactionIdUsed === "function") {
        const isUsed = await Order.isTransactionIdUsed(
          cleanTransactionId,
          orderId
        );
        if (isUsed) {
          return res.status(400).json({
            success: false,
            message:
              "This transaction ID has already been used. Each transaction ID can only be used once.",
          });
        }
      }
    } catch (checkError) {
      console.log(
        "Could not check transaction ID uniqueness:",
        checkError.message
      );
    }

    // Update payment information
    order.payment = {
      ...order.payment,
      transactionId: cleanTransactionId,
      screenshot: screenshot || null,
      upiId: upiId || null,
      paymentStatus: "pending_verification",
      submittedAt: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
    };

    await order.save();

    try {
      await sendAdminVerificationNotification(order);
    } catch (emailError) {
      console.log(
        "Note: Could not send admin notification:",
        emailError.message
      );
      // Don't fail the payment confirmation if email fails
    }

    console.log("✅ Payment submitted for verification:", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      transactionId: cleanTransactionId,
    });

    res.json({
      success: true,
      message:
        "Payment details submitted successfully. We will verify your payment within 24 hours and send you a confirmation.",
      order: order,
      orderNumber: order.orderNumber,
      requiresVerification: true,
    });
  } catch (error) {
    console.error("❌ Error submitting payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit payment details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @desc    Admin route to verify payments
// @route   POST /api/orders/:orderId/admin/verify-payment
// @access  Private (Admin only)
router.post("/:orderId/admin/verify-payment", adminAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { verified, notes } = req.body;

    console.log(`🔍 Admin verifying payment for order: ${orderId}`);

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update payment status
    order.payment.paymentStatus = verified ? "verified" : "rejected";
    order.payment.verificationDate = new Date();
    order.payment.verificationNotes = notes || "";
    order.payment.verifiedBy = req.admin.id || req.admin.username;

    if (verified) {
      order.status = "confirmed";
      order.confirmedAt = new Date();
    }

    await order.save();

    console.log(
      `✅ Payment ${verified ? "verified" : "rejected"} for order: ${
        order.orderNumber
      }`
    );

    res.json({
      success: true,
      message: verified
        ? "Payment verified successfully"
        : "Payment verification rejected",
    });
  } catch (error) {
    console.error("❌ Error verifying payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify payment",
    });
  }
});

// @desc    Update order status (Admin only) - ADD THIS ROUTE  
// @route   PUT /api/orders/:orderId/admin/update-status
// @access  Private (Admin only)
router.put("/:orderId/admin/update-status", adminAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    console.log(`🔄 Admin updating order ${orderId} status to ${status}`);

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Validate status
    const validStatuses = ['pending', 'pending_payment', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    // Update order status
    order.status = status;
    
    // Update specific timestamp fields based on status
    switch(status) {
      case 'confirmed':
        order.confirmedAt = new Date();
        break;
      case 'processing':
        order.processingAt = new Date();
        break;
      case 'shipped':
        order.shippedAt = new Date();
        break;
      case 'delivered':
        order.deliveredAt = new Date();
        break;
    }

    // Add to status history if the field exists
    if (!order.statusHistory) {
      order.statusHistory = [];
    }
    order.statusHistory.push({
      status,
      updatedBy: req.admin._id || req.admin.username || 'admin',
      updatedAt: new Date()
    });

    await order.save();

    console.log(`✅ Order ${order.orderNumber} status updated to ${status}`);

    res.json({
      success: true,
      message: "Order status updated successfully",
      order
    });

  } catch (error) {
    console.error("❌ Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message
    });
  }
});

// @desc    Get user's orders
// @route   GET /api/orders
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Use the model method to find user orders
    const orders = await Order.findByUser(req.user._id, { page, limit });
    const totalOrders = await Order.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      orders: orders.map((order) => order.getOrderSummary()),
      pagination: {
        current: page,
        pages: Math.ceil(totalOrders / limit),
        total: totalOrders,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
});

// @desc    Get single order details
// @route   GET /api/orders/:orderId
// @access  Private
router.get("/:orderId", auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify order belongs to user
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("❌ Error fetching order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
    });
  }
});

// @desc    Get order by order number (for confirmation page)
// @route   GET /api/orders/number/:orderNumber
// @access  Private
router.get("/number/:orderNumber", auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      orderNumber: req.params.orderNumber,
      userId: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Ensure payment object exists with default values
    if (!order.payment) {
      order.payment = {
        method: "UPI",
        paymentStatus: "pending",
        amount: order.total,
      };
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("❌ Error fetching order by number:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
    });
  }
});

// @desc    Cancel order
// @route   PUT /api/orders/:orderId/cancel
// @access  Private
router.put("/:orderId/cancel", auth, async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify order belongs to user
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Check if order can be cancelled
    if (["shipped", "delivered"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel shipped or delivered orders",
      });
    }

    // Update order status to cancelled
    await order.updateStatus("cancelled");
    order.cancellationReason = reason;
    await order.save();

    console.log("🚫 Order cancelled:", order.orderNumber);

    res.json({
      success: true,
      message: "Order cancelled successfully",
      order: order.getOrderSummary(),
    });
  } catch (error) {
    console.error("❌ Error cancelling order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
    });
  }
});

// @desc    Track order status
// @route   GET /api/orders/:orderId/track
// @access  Private
router.get("/:orderId/track", auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify order belongs to user
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Create tracking timeline based on new status flow
    const timeline = [
      {
        status: "pending",
        label: "Order Placed",
        date: order.orderDate,
        completed: true,
      },
      {
        status: "payment_submitted",
        label: "Payment Submitted",
        date: order.payment?.submittedAt,
        completed: !!order.payment?.submittedAt,
      },
      {
        status: "confirmed",
        label: "Payment Verified & Order Confirmed",
        date: order.confirmedAt,
        completed: !!order.confirmedAt,
      },
      {
        status: "processing",
        label: "Processing",
        date: order.status === "processing" ? new Date() : null,
        completed: ["processing", "shipped", "delivered"].includes(
          order.status
        ),
      },
      {
        status: "shipped",
        label: "Shipped",
        date: order.shippedAt,
        completed: ["shipped", "delivered"].includes(order.status),
      },
      {
        status: "delivered",
        label: "Delivered",
        date: order.deliveredAt,
        completed: order.status === "delivered",
      },
    ];

    res.json({
      success: true,
      tracking: {
        orderNumber: order.orderNumber,
        currentStatus: order.status,
        paymentStatus: order.payment?.paymentStatus,
        trackingNumber: order.trackingNumber,
        timeline,
        estimatedDelivery: null, // You can add logic to calculate this
      },
    });
  } catch (error) {
    console.error("❌ Error tracking order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to track order",
    });
  }
});

// Helper functions (Email functionality) - Updated to use emailService
async function sendAdminVerificationNotification(order) {
  try {
    console.log(`📧 Admin notification needed for order ${order.orderNumber}`);

    // Send to admin email (you can set this in environment variables)
    const adminEmail = process.env.ADMIN_EMAIL;

    await sendOrderNotificationEmail(adminEmail, "admin_payment_verification", {
      orderNumber: order.orderNumber,
      customerName: order.shippingAddress.name,
      amount: order.total,
      transactionId: order.payment.transactionId,
      orderDate: order.orderDate || order.createdAt,
      customerEmail: order.shippingAddress.email,
      items: order.items,
    });

    console.log(
      `✅ Admin verification notification sent for order ${order.orderNumber}`
    );
  } catch (error) {
    console.error("Failed to send admin notification:", error);
  }
}

async function sendCustomerConfirmationEmail(order) {
  try {
    console.log(`📧 Sending confirmation email for order ${order.orderNumber}`);

    await sendOrderNotificationEmail(
      order.shippingAddress.email,
      "order_confirmed",
      {
        customerName: order.shippingAddress.name,
        orderNumber: order.orderNumber,
        amount: order.total,
        orderDate: order.orderDate || order.createdAt,
        items: order.items,
        shippingAddress: order.shippingAddress,
        trackingUrl: `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/orders/${order._id}/track`,
      }
    );

    console.log(
      `✅ Customer confirmation email sent for order ${order.orderNumber}`
    );
  } catch (error) {
    console.error("Failed to send customer confirmation email:", error);
  }
}

async function sendCustomerPaymentFailedEmail(order) {
  try {
    console.log(
      `📧 Sending payment failed email for order ${order.orderNumber}`
    );

    await sendOrderNotificationEmail(
      order.shippingAddress.email,
      "payment_failed",
      {
        customerName: order.shippingAddress.name,
        orderNumber: order.orderNumber,
        amount: order.total,
        reason: "Payment verification failed",
        retryUrl: `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/orders/${order._id}`,
      }
    );

    console.log(`✅ Payment failed email sent for order ${order.orderNumber}`);
  } catch (error) {
    console.error("Failed to send customer payment failed email:", error);
  }
}

module.exports = router;
