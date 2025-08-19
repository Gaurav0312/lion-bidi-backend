// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { generateOTP, sendEmailOTP } = require('../utils/emailService');


// Add these imports at the top if not already present
const bcrypt = require('bcryptjs');

// ========================
// Forgot Password - Send Reset OTP
// ========================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('Forgot password request for:', email);
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    // Check if user exists (but don't reveal in response for security)
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (user) {
      // Generate and store OTP
      const otp = generateOTP();
      const otpKey = `reset:${email.toLowerCase()}`;
      storeOTP(otpKey, otp, 5); // 5 minutes expiration for reset OTP
      
      console.log('Password reset OTP generated for:', email);
      
      try {
        // Send email with reset OTP
        await sendEmailOTP(email, otp, 'reset');
        console.log('Password reset email sent successfully');
      } catch (emailError) {
        console.error('Failed to send reset email:', emailError);
        // Clean up stored OTP if email fails
        otpStore.delete(otpKey);
        return res.status(500).json({ 
          message: 'Failed to send reset code. Please try again.',
          error: emailError.message
        });
      }
    }
    
    // Always return success message to prevent email enumeration
    res.status(200).json({ 
      message: 'If an account exists with this email, a reset code has been sent.',
      email: email.toLowerCase()
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error occurred. Please try again.' });
  }
});

// ========================
// Verify Reset OTP
// ========================
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    console.log('Verifying reset OTP for:', email);
    
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    // Verify OTP
    const otpKey = `reset:${email.toLowerCase()}`;
    if (!verifyStoredOTP(otpKey, otp)) {
      return res.status(400).json({ 
        message: 'Invalid or expired code',
        code: 'INVALID_OTP'
      });
    }

    console.log('Reset OTP verified successfully for:', email);
    
    res.status(200).json({ 
      message: 'Code verified successfully',
      email: email.toLowerCase()
    });
    
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({ message: 'Server error occurred. Please try again.' });
  }
});

// ========================
// Reset Password
// ========================
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    console.log('Password reset attempt for:', email);
    
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    // Verify OTP one more time
    const otpKey = `reset:${email.toLowerCase()}`;
    if (!verifyStoredOTP(otpKey, otp)) {
      return res.status(400).json({ 
        message: 'Invalid or expired code',
        code: 'INVALID_OTP'
      });
    }

    // Update password
    user.password = newPassword; // This will be hashed by the pre-save middleware
    await user.save();

    // Clear the OTP
    otpStore.delete(otpKey);
    
    console.log('Password reset completed successfully for:', email);

    res.status(200).json({ 
      message: 'Password reset successfully. You can now login with your new password.',
      email: email.toLowerCase()
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    res.status(500).json({ message: 'Failed to reset password. Please try again.' });
  }
});


// In-memory OTP storage (use Redis in production)
const otpStore = new Map();

// Store OTP with expiration
const storeOTP = (key, otp, expirationMinutes = 10) => {
  const expiresAt = Date.now() + (expirationMinutes * 60 * 1000);
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
    console.log('No OTP found for key');
    return false;
  }
  
  if (Date.now() > stored.expiresAt) {
    console.log('OTP expired');
    otpStore.delete(key);
    return false;
  }
  
  const isValid = stored.otp === providedOtp;
  console.log('OTP validation result:', isValid);
  return isValid;
};

// Test email route (remove in production)
router.post('/test-email', async (req, res) => {
  try {
    const { testEmailService } = require('../utils/emailService');
    const result = await testEmailService();
    res.json({ 
      success: result, 
      message: result ? 'Email service working' : 'Email service failed' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this test route (remove in production)
router.post('/test-email', async (req, res) => {
  try {
    const { testEmailService, generateOTP, sendEmailOTP } = require('../utils/emailService');
    
    console.log('Starting email service test...');
    
    // Test with a real email address
    const testOtp = generateOTP();
    await sendEmailOTP('lionbidicompany@gmail.com', testOtp, 'verification');
    
    res.json({ 
      success: true, 
      message: 'Test email sent successfully',
      otp: testOtp // Only for testing
    });
  } catch (error) {
    console.error('Email test failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: {
        code: error.code,
        command: error.command
      }
    });
  }
});



// ========================
// Check Email/Phone Availability
// ========================
router.post('/check-availability', async (req, res) => {
  console.log("check-availability req.body:", req.body);
  try {
    const { email, phone } = req.body;
    
    console.log('Checking availability for:', { email, phone });
    
    if (!email && !phone) {
      return res.status(400).json({ message: 'Email or phone is required' });
    }

    const query = {};
    if (email) query.email = email.toLowerCase();
    if (phone) query.phone = phone;

    const existingUser = await User.findOne({
      $or: Object.keys(query).map(key => ({ [key]: query[key] }))
    });

    if (existingUser) {
      const conflict = existingUser.email === email?.toLowerCase() ? 'email' : 'phone';
      return res.status(400).json({ 
        message: `${conflict === 'email' ? 'Email' : 'Phone number'} already registered` 
      });
    }

    res.status(200).json({ message: 'Available' });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========================
// Send Registration OTP
// ========================
router.post('/send-registration-otp', async (req, res) => {
  console.log("send-registration-otp req.body:", req.body);
  try {
    const { email, name } = req.body;
    
    console.log('Registration OTP request:', { email, name });

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Generate and store OTP
    const otp = generateOTP();
    const otpKey = `registration:${email.toLowerCase()}`;
    storeOTP(otpKey, otp);

    // Send email
    try {
      await sendEmailOTP(email, otp, 'verification');
      console.log('Registration OTP sent successfully');
      
      res.status(200).json({ 
        message: 'Verification code sent to your email',
        email: email.toLowerCase()
      });
    } catch (emailError) {
      console.error('Failed to send registration email:', emailError);
      // Clean up stored OTP if email fails
      otpStore.delete(otpKey);
      res.status(500).json({ 
        message: 'Failed to send verification code. Please try again.',
        error: emailError.message
      });
    }
    
  } catch (error) {
    console.error('Send registration OTP error:', error);
    res.status(500).json({ message: 'Failed to send verification code' });
  }
});

// ========================
// Send Login OTP
// ========================
router.post('/send-login-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    // Generate and store OTP
    const otp = generateOTP();
    const otpKey = `login:${email.toLowerCase()}`;
    storeOTP(otpKey, otp);

    // Send email
    await sendEmailOTP(email, otp, 'login');

    res.status(200).json({ 
      message: 'Login code sent to your email',
      email: email.toLowerCase()
    });
  } catch (error) {
    console.error('Send login OTP error:', error);
    res.status(500).json({ message: 'Failed to send login code' });
  }
});

// ============
// Register with Email OTP
// ============
router.post('/register', async (req, res) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      password, 
      emailOtp, 
      dateOfBirth, 
      address 
    } = req.body;

    console.log('Registration attempt:', { name, email, phone, emailOtp, dateOfBirth });

    // Validate required fields
    if (!name || !email || !phone || !password || !emailOtp) {
      return res.status(400).json({ 
        message: 'Name, email, phone, password, and email OTP are required' 
      });
    }

    // Validate OTP
    const otpKey = `registration:${email.toLowerCase()}`;
    if (!verifyStoredOTP(otpKey, emailOtp)) {
      return res.status(400).json({ 
        message: 'Invalid or expired verification code',
        code: 'INVALID_OTP'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phone: phone }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email or phone' });
    }

    // Create user data
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone,
      password,
      isEmailVerified: true, // Since OTP was verified
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined
    };

    // Add address if provided
    if (address && address.street) {
      userData.address = address;
      userData.addresses = [{
        ...address,
        isDefault: true
      }];
    }

    console.log('Creating user with data:', { ...userData, password: '[HIDDEN]' });

    // Create user
    const user = await User.create(userData);

    // Clear OTP
    otpStore.delete(otpKey);
    console.log('User created successfully:', user._id);

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    // Return user data (excluding password)
    const userResponse = {
      _id: user._id,
      id: user._id, // For compatibility
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin: user.isAdmin || false,
      role: user.role || 'user',
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified || false,
      addresses: user.addresses || [],
      wishlist: user.wishlist || [],
      cart: user.cart || []
    };

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `${field === 'email' ? 'Email' : 'Phone number'} already exists` 
      });
    }
    
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// =============
// Login with Email/Password or Email/OTP
// =============
router.post('/login', async (req, res) => {
  try {
    // Email + OTP login
    if (req.body.email && req.body.otp) {
      const { email, otp } = req.body;
      
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(400).json({ message: 'Invalid email or OTP' });
      }

      // Verify OTP
      const otpKey = `login:${email.toLowerCase()}`;
      if (!verifyStoredOTP(otpKey, otp)) {
        return res.status(400).json({ 
          message: 'Invalid or expired OTP',
          code: 'INVALID_OTP'
        });
      }

      // Clear OTP
      otpStore.delete(otpKey);

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '30d' }
      );

      return res.json({
        message: 'Login successful',
        token,
        user: {
          _id: user._id,
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isAdmin: user.isAdmin,
          wishlist: user.wishlist
        }
      });
    }

    // Email + Password login
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        wishlist: user.wishlist
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ================
// Get current user
// ================
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================
// Update profile
// ================
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone, address, dateOfBirth } = req.body;

    // Check if phone is being updated to something that's already taken
    if (phone) {
      const exists = await User.findOne({ phone, _id: { $ne: req.user.id } });
      if (exists) {
        return res.status(400).json({ message: 'Phone already registered' });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name,
        phone,
        address,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ==================
// Change password
// ==================
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});



module.exports = router;