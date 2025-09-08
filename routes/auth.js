// routes/auth.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { OAuth2Client } = require('google-auth-library');
const { generateOTP, sendEmailOTP } = require("../utils/emailService");
const bcrypt = require("bcryptjs");
const axios = require('axios'); // Add this import - it's missing!


// Add Firebase Admin import
const admin = require("../config/firebase-admin");

let firebaseAdmin = null;
try {
  const firebase = require("../config/firebase-admin");
  firebaseAdmin = firebase;
  console.log("Firebase admin loaded successfully");
} catch (error) {
  console.warn("Firebase admin failed to load:", error.message);
  console.warn("Social login will be disabled");
}

// ==================== SOCIAL LOGIN (Google/Facebook) ====================
router.post("/social-login", async (req, res) => {
  try {
    const { provider, idToken, email, name, avatar, uid } = req.body;
    console.log("Social login request received:", { provider, email, name });

    // Check if Firebase is available
    if (!firebaseAdmin || !firebaseAdmin.isInitialized()) {
      console.warn(
        "Firebase not initialized, falling back to basic social login"
      );

      // Fallback: Create/login user without Firebase verification
      // This is less secure but allows social login to work
      return await handleSocialLoginFallback(req, res, {
        provider,
        email,
        name,
        avatar,
        uid,
      });
    }

    // Verify Firebase token
    try {
      console.log("Verifying Firebase token...");
      const decodedToken = await firebaseAdmin.verifyIdToken(idToken);
      console.log("Token verified successfully for:", decodedToken.email);

      return await handleSocialLogin(req, res, {
        provider,
        email: decodedToken.email,
        name: decodedToken.name,
        avatar: decodedToken.picture,
        uid: decodedToken.uid,
        verified: true,
      });
    } catch (tokenError) {
      console.error("Token verification failed:", tokenError);
      return res.status(401).json({
        success: false,
        message: "Invalid social login token",
        error: tokenError.message,
      });
    }
  } catch (error) {
    console.error("Social login error:", error);
    res.status(500).json({
      success: false,
      message: "Social login failed",
      error: error.message,
    });
  }
});

// Helper function for verified social login
const handleSocialLogin = async (req, res, userData) => {
  try {
    const { provider, email, name, avatar, uid } = userData;

    // Check if user exists
    let user = await User.findOne({
      $or: [{ email }, { providerId: uid, provider }],
    });

    if (user) {
      // Update existing user
      user.lastLogin = new Date();
      user.avatar = avatar || user.avatar;
      user.name = name || user.name;
      if (!user.providerId) {
        user.provider = provider;
        user.providerId = uid;
      }
      await user.save();
      console.log("Existing social user logged in:", user.email);
    } else {
      // Create new user
      user = await User.create({
        name,
        email,
        provider,
        providerId: uid,
        avatar,
        isEmailVerified: true, // Social accounts are pre-verified
        lastLogin: new Date(),
      });
      console.log("New social user created:", user.email);
    }

    // Generate JWT token
    const token = user.getSignedJwtToken();

    // Prepare response
    const userResponse = { ...user.toObject() };
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "Social login successful",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Handle social login error:", error);
    res.status(500).json({
      success: false,
      message: "Social login processing failed",
      error: error.message,
    });
  }
};


// Google OAuth callback handler - Add this route to your existing auth.js
// Fixed Google OAuth callback handler - Replace the problematic route in your routes/auth.js

router.post('/google/callback', async (req, res) => {
  try {
    const { code } = req.body;
    
    console.log('Google OAuth callback received with code:', !!code);
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      });
    }

    // Check required environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Missing Google OAuth credentials in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Google OAuth not properly configured'
      });
    }
    
    console.log('Exchanging code for access token...');
    
    // Exchange authorization code for access token
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/google/callback`
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const { access_token } = tokenResponse.data;
    console.log('Access token received from Google');
    
    // Get user information from Google
    const googleUserResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });
    
    const googleUser = googleUserResponse.data;
    console.log('Google user data received:', {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name
    });
    
    // Find or create user in your database
    let user = await User.findOne({ 
      $or: [
        { email: googleUser.email },
        { googleId: googleUser.id }
      ]
    });
    
    if (user) {
      // Update existing user
      user.googleId = googleUser.id;
      user.name = googleUser.name || user.name;
      user.avatar = googleUser.picture || user.avatar;
      user.isEmailVerified = true; // Google accounts are verified
      user.provider = 'google';
      user.lastLogin = new Date();
      await user.save();
      
      console.log('Existing Google user logged in:', user.email);
    } else {
      // Create new user
      user = await User.create({
        name: googleUser.name,
        email: googleUser.email,
        googleId: googleUser.id,
        avatar: googleUser.picture,
        provider: 'google',
        isEmailVerified: true, // Google accounts are pre-verified
        lastLogin: new Date(),
        // Don't require password or phone for Google users
      });
      
      console.log('New Google user created:', user.email);
    }
    
    // Generate JWT token
    const token = user.getSignedJwtToken();
    
    // Prepare user data for response (remove sensitive data)
    const userData = { ...user.toObject() };
    delete userData.password;
    delete userData.__v;
    
    res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      token,
      user: userData
    });
    
  } catch (error) {
    console.error('Google OAuth error:', error);
    
    // More detailed error logging
    if (error.response) {
      console.error('Google API error response:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    
    // Handle specific error cases
    if (error.response?.status === 400) {
      return res.status(400).json({
        success: false,
        message: 'Invalid authorization code or expired session'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Google authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

router.post('/google-signin', async (req, res) => {
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required'
      });
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    console.log('Google user payload:', { googleId, email, name });

    // Check if user exists
    let user = await User.findOne({ 
      $or: [{ email }, { providerId: googleId, provider: 'google' }]
    });

    if (user) {
      // Update existing user
      user.lastLogin = new Date();
      user.avatar = picture || user.avatar;
      user.name = name || user.name;
      if (!user.providerId) {
        user.provider = 'google';
        user.providerId = googleId;
      }
      await user.save();
      console.log('Existing Google user logged in:', user.email);
    } else {
      // Create new user
      user = await User.create({
        name,
        email,
        provider: 'google',
        providerId: googleId,
        avatar: picture,
        isEmailVerified: true,
        lastLogin: new Date(),
        // Set a default phone or make it optional in your User model
        phone: '0000000000', // You might want to handle this differently
      });
      console.log('New Google user created:', user.email);
    }

    // Generate JWT token
    const token = user.getSignedJwtToken();

    // Prepare response
    const userResponse = { ...user.toObject() };
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Google sign-in successful',
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error('Google sign-in error:', error);
    res.status(400).json({
      success: false,
      message: 'Google sign-in failed',
      error: error.message,
    });
  }
});

// Fallback function for when Firebase is not available
const handleSocialLoginFallback = async (req, res, userData) => {
  try {
    const { provider, email, name, avatar, uid } = userData;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: "Email and name are required for social login",
      });
    }

    console.log("Using social login fallback for:", email);

    // Check if user exists by email
    let user = await User.findOne({ email });

    if (user) {
      // Update existing user
      user.lastLogin = new Date();
      user.avatar = avatar || user.avatar;
      user.name = name || user.name;
      user.provider = provider;
      user.providerId = uid;
      await user.save();
      console.log("Existing user updated with social info:", user.email);
    } else {
      // Create new user
      user = await User.create({
        name,
        email,
        provider,
        providerId: uid,
        avatar,
        isEmailVerified: true,
        lastLogin: new Date(),
        // Don't require phone for social login
      });
      console.log("New social user created (fallback):", user.email);
    }

    // Generate JWT token
    const token = user.getSignedJwtToken();

    // Prepare response
    const userResponse = { ...user.toObject() };
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "Social login successful (fallback mode)",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Social login fallback error:", error);
    res.status(500).json({
      success: false,
      message: "Social login failed",
      error: error.message,
    });
  }
};


// POST /api/orders/:orderId/confirm-payment
router.post('/:orderId/confirm-payment', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { transactionId, screenshot, upiId } = req.body;

    // Validate required fields
    if (!transactionId || !transactionId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required'
      });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order with payment confirmation
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        $set: {
          status: 'confirmed',
          confirmedAt: new Date(),
          'payment.paymentStatus': 'completed',
          'payment.transactionId': transactionId.trim(),
          'payment.confirmedAt': new Date(),
          'payment.method': 'UPI'
        }
      },
      { new: true, runValidators: true }
    );

    // Ensure payment object exists
    if (!updatedOrder.payment) {
      updatedOrder.payment = {
        method: 'UPI',
        paymentStatus: 'completed',
        transactionId: transactionId.trim(),
        confirmedAt: new Date()
      };
      await updatedOrder.save();
    }

    console.log('Order payment confirmed:', {
      orderId: updatedOrder._id,
      orderNumber: updatedOrder.orderNumber,
      paymentStatus: updatedOrder.payment.paymentStatus
    });

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      order: updatedOrder,
      orderNumber: updatedOrder.orderNumber
    });

  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/orders/number/:orderNumber - Get order by order number
router.get('/number/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const order = await Order.findOne({ orderNumber: orderNumber });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Ensure payment object exists with default values
    if (!order.payment) {
      order.payment = {
        method: 'UPI',
        paymentStatus: 'pending'
      };
    }

    res.json({
      success: true,
      order: order
    });

  } catch (error) {
    console.error('Error fetching order by number:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== REGULAR EMAIL/PASSWORD LOGIN ====================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Email login attempt for:", email);

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    // Verify password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = user.getSignedJwtToken();

    // Remove password from response
    const userResponse = { ...user.toObject() };
    delete userResponse.password;

    console.log("Email login successful for:", user.email);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Email login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
});

// ================
// Verify Authentication
// ================
router.get("/verify", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: user,
    });
  } catch (error) {
    console.error("Verify auth error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ========================
// Forgot Password - Send Reset OTP
// ========================
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    console.log("Forgot password request for:", email);

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "Please provide a valid email address" });
    }

    // Check if user exists (but don't reveal in response for security)
    const user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // Generate and store OTP
      const otp = generateOTP();
      const otpKey = `reset:${email.toLowerCase()}`;
      storeOTP(otpKey, otp, 5); // 5 minutes expiration for reset OTP

      console.log("Password reset OTP generated for:", email);

      try {
        // Send email with reset OTP
        await sendEmailOTP(email, otp, "reset");
        console.log("Password reset email sent successfully");
      } catch (emailError) {
        console.error("Failed to send reset email:", emailError);
        // Clean up stored OTP if email fails
        otpStore.delete(otpKey);
        return res.status(500).json({
          message: "Failed to send reset code. Please try again.",
          error: emailError.message,
        });
      }
    }

    // Always return success message to prevent email enumeration
    res.status(200).json({
      message:
        "If an account exists with this email, a reset code has been sent.",
      email: email.toLowerCase(),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res
      .status(500)
      .json({ message: "Server error occurred. Please try again." });
  }
});

// ========================
// Verify Reset OTP
// ========================
router.post("/verify-reset-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log("Verifying reset OTP for:", email);

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Verify OTP
    const otpKey = `reset:${email.toLowerCase()}`;
    if (!verifyStoredOTP(otpKey, otp)) {
      return res.status(400).json({
        message: "Invalid or expired code",
        code: "INVALID_OTP",
      });
    }

    console.log("Reset OTP verified successfully for:", email);

    res.status(200).json({
      message: "Code verified successfully",
      email: email.toLowerCase(),
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    res
      .status(500)
      .json({ message: "Server error occurred. Please try again." });
  }
});

// ========================
// Reset Password
// ========================
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    console.log("Password reset attempt for:", email);

    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({ message: "Email, OTP, and new password are required" });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Verify OTP one more time
    const otpKey = `reset:${email.toLowerCase()}`;
    if (!verifyStoredOTP(otpKey, otp)) {
      return res.status(400).json({
        message: "Invalid or expired code",
        code: "INVALID_OTP",
      });
    }

    // Update password
    user.password = newPassword; // This will be hashed by the pre-save middleware
    await user.save();

    // Clear the OTP
    otpStore.delete(otpKey);

    console.log("Password reset completed successfully for:", email);

    res.status(200).json({
      message:
        "Password reset successfully. You can now login with your new password.",
      email: email.toLowerCase(),
    });
  } catch (error) {
    console.error("Reset password error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ message: messages.join(", ") });
    }

    res
      .status(500)
      .json({ message: "Failed to reset password. Please try again." });
  }
});

// In-memory OTP storage (use Redis in production)
const otpStore = new Map();

// Store OTP with expiration
const storeOTP = (key, otp, expirationMinutes = 10) => {
  const expiresAt = Date.now() + expirationMinutes * 60 * 1000;
  otpStore.set(key, { otp, expiresAt });

  // Auto cleanup expired OTPs
  setTimeout(() => {
    otpStore.delete(key);
  }, expirationMinutes * 60 * 1000);

  console.log(`OTP stored for key: ${key}, expires at: ${new Date(expiresAt)}`);
};

// Verify stored OTP
const verifyStoredOTP = (key, providedOtp) => {
  const stored = otpStore.get(key);
  console.log(`Verifying OTP for key: ${key}`);
  console.log(`Stored:`, stored);
  console.log(`Provided:`, providedOtp);

  if (!stored) {
    console.log("No OTP found for key");
    return false;
  }

  if (Date.now() > stored.expiresAt) {
    console.log("OTP expired");
    otpStore.delete(key);
    return false;
  }

  const isValid = stored.otp === providedOtp;
  console.log("OTP validation result:", isValid);
  return isValid;
};

// Test email route (remove in production)
router.post("/test-email", async (req, res) => {
  try {
    const { testEmailService } = require("../utils/emailService");
    const result = await testEmailService();
    res.json({
      success: result,
      message: result ? "Email service working" : "Email service failed",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this test route (remove in production)
router.post("/test-email", async (req, res) => {
  try {
    const {
      testEmailService,
      generateOTP,
      sendEmailOTP,
    } = require("../utils/emailService");

    console.log("Starting email service test...");

    // Test with a real email address
    const testOtp = generateOTP();
    await sendEmailOTP("lionbidicompany@gmail.com", testOtp, "verification");

    res.json({
      success: true,
      message: "Test email sent successfully",
      otp: testOtp, // Only for testing
    });
  } catch (error) {
    console.error("Email test failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: {
        code: error.code,
        command: error.command,
      },
    });
  }
});

// ========================
// Check Email/Phone Availability
// ========================
router.post("/check-availability", async (req, res) => {
  console.log("check-availability req.body:", req.body);
  try {
    const { email, phone } = req.body;

    console.log("Checking availability for:", { email, phone });

    if (!email && !phone) {
      return res.status(400).json({ message: "Email or phone is required" });
    }

    const query = {};
    if (email) query.email = email.toLowerCase();
    if (phone) query.phone = phone;

    const existingUser = await User.findOne({
      $or: Object.keys(query).map((key) => ({ [key]: query[key] })),
    });

    if (existingUser) {
      const conflict =
        existingUser.email === email?.toLowerCase() ? "email" : "phone";
      return res.status(400).json({
        message: `${
          conflict === "email" ? "Email" : "Phone number"
        } already registered`,
      });
    }

    res.status(200).json({ message: "Available" });
  } catch (error) {
    console.error("Check availability error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================
// Send Registration OTP
// ========================
router.post("/send-registration-otp", async (req, res) => {
  console.log("send-registration-otp req.body:", req.body);
  try {
    const { email, name } = req.body;

    console.log("Registration OTP request:", { email, name });

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "Please provide a valid email address" });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Generate and store OTP
    const otp = generateOTP();
    const otpKey = `registration:${email.toLowerCase()}`;
    storeOTP(otpKey, otp);

    // Send email
    try {
      await sendEmailOTP(email, otp, "verification");
      console.log("Registration OTP sent successfully");

      res.status(200).json({
        message: "Verification code sent to your email",
        email: email.toLowerCase(),
      });
    } catch (emailError) {
      console.error("Failed to send registration email:", emailError);
      // Clean up stored OTP if email fails
      otpStore.delete(otpKey);
      res.status(500).json({
        message: "Failed to send verification code. Please try again.",
        error: emailError.message,
      });
    }
  } catch (error) {
    console.error("Send registration OTP error:", error);
    res.status(500).json({ message: "Failed to send verification code" });
  }
});

// ========================
// Send Login OTP
// ========================
router.post("/send-login-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res
        .status(404)
        .json({ message: "No account found with this email" });
    }

    // Generate and store OTP
    const otp = generateOTP();
    const otpKey = `login:${email.toLowerCase()}`;
    storeOTP(otpKey, otp);

    // Send email
    await sendEmailOTP(email, otp, "login");

    res.status(200).json({
      message: "Login code sent to your email",
      email: email.toLowerCase(),
    });
  } catch (error) {
    console.error("Send login OTP error:", error);
    res.status(500).json({ message: "Failed to send login code" });
  }
});

// ============
// Register with Email OTP
// ============
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, emailOtp, dateOfBirth, address } =
      req.body;

    console.log("Registration attempt:", {
      name,
      email,
      phone,
      emailOtp,
      dateOfBirth,
    });

    // Validate required fields
    if (!name || !email || !phone || !password || !emailOtp) {
      return res.status(400).json({
        message: "Name, email, phone, password, and email OTP are required",
      });
    }

    // Validate OTP
    const otpKey = `registration:${email.toLowerCase()}`;
    if (!verifyStoredOTP(otpKey, emailOtp)) {
      return res.status(400).json({
        message: "Invalid or expired verification code",
        code: "INVALID_OTP",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: phone }],
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email or phone" });
    }

    // Create user data
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone,
      password,
      isEmailVerified: true, // Since OTP was verified
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    };

    // Add address if provided
    if (address && address.street) {
      userData.address = address;
      userData.addresses = [
        {
          ...address,
          isDefault: true,
        },
      ];
    }

    console.log("Creating user with data:", {
      ...userData,
      password: "[HIDDEN]",
    });

    // Create user
    const user = await User.create(userData);

    // Clear OTP
    otpStore.delete(otpKey);
    console.log("User created successfully:", user._id);

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    // Return user data (excluding password)
    const userResponse = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin: user.isAdmin || false,
      role: user.role || "customer",
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified || false,
      addresses: user.addresses || [],
      wishlist: user.wishlist || [],
      cart: user.cart || [],
      cartTotal: user.getCartTotal(),
      cartItemsCount: user.getCartItemsCount(),
    };

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ message: messages.join(", ") });
    }

    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        message: `${
          field === "email" ? "Email" : "Phone number"
        } already exists`,
      });
    }

    res.status(500).json({ message: "Registration failed. Please try again." });
  }
});

// ========================
// Resend Email OTP (alias for registration)
// ========================
router.post("/send-email-otp", async (req, res) => {
  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const otp = generateOTP();
    const otpKey = `registration:${email.toLowerCase()}`;
    storeOTP(otpKey, otp);

    await sendEmailOTP(email, otp, "verification");

    res.status(200).json({
      message: "Verification code resent successfully",
      email: email.toLowerCase(),
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ message: "Failed to resend OTP" });
  }
});

// =============
// Login with Email/Password or Email/OTP
// =============
router.post("/login", async (req, res) => {
  try {
    // Email + OTP login
    if (req.body.email && req.body.otp) {
      const { email, otp } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(400).json({ message: "Invalid email or OTP" });
      }

      // Verify OTP
      const otpKey = `login:${email.toLowerCase()}`;
      if (!verifyStoredOTP(otpKey, otp)) {
        return res.status(400).json({
          message: "Invalid or expired OTP",
          code: "INVALID_OTP",
        });
      }

      // Clear OTP
      otpStore.delete(otpKey);

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "30d" }
      );

      return res.json({
        message: "Login successful",
        token,
        user: {
          _id: user._id,
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isAdmin: user.isAdmin || false,
          role: user.role || "customer",
          wishlist: user.wishlist || [],
          cart: user.cart || [],
          cartTotal: user.getCartTotal(),
          cartItemsCount: user.getCartItemsCount(),
        },
      });
    }

    // Email + Password login
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin || false,
        role: user.role || "customer",
        wishlist: user.wishlist || [],
        cart: user.cart || [],
        cartTotal: user.getCartTotal(),
        cartItemsCount: user.getCartItemsCount(),
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ================
// Get current user
// ================
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================
// Update profile
// ================
router.put("/profile", auth, async (req, res) => {
  try {
    const { name, phone, address, dateOfBirth } = req.body;

    // Check if phone is being updated to something that's already taken
    if (phone) {
      const exists = await User.findOne({ phone, _id: { $ne: req.user.id } });
      if (exists) {
        return res.status(400).json({ message: "Phone already registered" });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name,
        phone,
        address,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      },
      { new: true, runValidators: true }
    ).select("-password");

    res.json({ message: "Profile updated successfully", user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ==================
// Change password
// ==================
router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
