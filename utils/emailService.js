// utils/emailService.js
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// Email configuration with enhanced error handling
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error(
      "Email credentials not configured. Please set EMAIL_USER and EMAIL_PASS environment variables."
    );
  }

  const transporter = nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  transporter.verify((error, success) => {
    if (error) {
      console.error("Email transporter verification failed:", error);
    } else {
      console.log("Email transporter ready for sending emails");
    }
  });

  return transporter;
};

// Generate OTP with enhanced security
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const sendOrderNotificationEmail = async (email, type, orderData) => {
  try {
    console.log(`Sending ${type} email to:`, email);

    const transporter = createTransporter();
    const template = getOrderEmailTemplate(type, orderData);

    const mailOptions = {
      from: `"Lion Bidi - Premium Quality" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: template.subject,
      html: template.html,
      headers: {
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        Importance: "High",
      },
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`${type} email sent successfully:`, result.messageId);
    return result;
  } catch (error) {
    console.error(`Send ${type} email error:`, error);
    throw new Error(`Failed to send ${type} email: ${error.message}`);
  }
};

// Enhanced email templates with modern UI/UX design
const getEmailTemplate = (otp, type = "verification") => {
  const baseStyles = `
    <style>
      /* Reset and base styles */
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
        line-height: 1.6; 
        color: #1f2937; 
        background-color: #f8fafc;
        margin: 0;
        padding: 0;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      
      /* Container styles */
      .email-wrapper { 
        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); 
        padding: 40px 20px; 
        min-height: 100vh;
      }
      .email-container { 
        max-width: 600px; 
        margin: 0 auto; 
        background: #ffffff; 
        border-radius: 16px; 
        overflow: hidden; 
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        border: 1px solid #e2e8f0;
      }
      
      /* Header styles */
      .email-header { 
        background: linear-gradient(135deg, #ea580c 0%, #dc2626 50%, #b91c1c 100%); 
        padding: 40px 30px; 
        text-align: center; 
        position: relative;
        overflow: hidden;
      }
      .email-header::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: url('data:image/svg+xml,<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="1" fill="white" opacity="0.1"/></svg>');
        animation: float 20s ease-in-out infinite;
      }
      @keyframes float {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-10px) rotate(180deg); }
      }
      .logo { 
        width: 60px; 
        height: 60px; 
        border-radius: 12px; 
        margin-bottom: 16px;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        position: relative;
        z-index: 1;
      }
      .email-header h1 { 
        color: #ffffff; 
        font-size: 32px; 
        font-weight: 700; 
        margin-bottom: 8px;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        position: relative;
        z-index: 1;
      }
      .email-header p { 
        color: #fef2f2; 
        font-size: 16px; 
        font-weight: 500;
        opacity: 0.9;
        position: relative;
        z-index: 1;
      }
      
      /* Content styles */
      .email-content { 
        padding: 50px 40px; 
        background: #ffffff;
      }
      .email-content h2 { 
        color: #111827; 
        font-size: 28px; 
        font-weight: 700; 
        margin-bottom: 16px; 
        text-align: center;
      }
      .email-content p { 
        color: #4b5563; 
        font-size: 16px; 
        margin-bottom: 24px; 
        text-align: center; 
        line-height: 1.7;
      }
      
      /* OTP Box styles */
      .otp-container { 
        background: linear-gradient(135deg, #fef2f2 0%, #fdf2f8 100%); 
        border: 2px solid #fecaca; 
        border-radius: 16px; 
        padding: 40px 20px; 
        margin: 40px 0; 
        text-align: center;
        position: relative;
        overflow: hidden;
      }
      .otp-container::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #ea580c, #dc2626, #ea580c);
      }
      .otp-container h3 { 
        color: #374151; 
        font-size: 20px; 
        font-weight: 600; 
        margin-bottom: 20px;
      }
      .otp-code { 
        font-size: 48px; 
        font-weight: 800; 
        color: #dc2626; 
        letter-spacing: 8px; 
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        background: linear-gradient(135deg, #dc2626, #b91c1c);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        text-shadow: 0 4px 8px rgba(220, 38, 38, 0.3);
        margin: 20px 0;
        padding: 20px;
        border-radius: 12px;
        background-color: #ffffff;
        border: 1px solid #fecaca;
      }
      
      /* Alert and info boxes */
      .alert-box { 
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); 
        border: 1px solid #f59e0b; 
        border-radius: 12px; 
        padding: 20px; 
        margin: 30px 0; 
        text-align: center;
        position: relative;
      }
      .alert-box::before {
        content: '⚠️';
        font-size: 24px;
        margin-bottom: 8px;
        display: block;
      }
      .alert-box strong { 
        color: #92400e; 
        font-weight: 700;
      }
      
      .info-box {
        background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
        border: 1px solid #3b82f6;
        border-radius: 12px;
        padding: 20px;
        margin: 30px 0;
        text-align: left;
      }
      
      /* Footer styles */
      .email-footer { 
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); 
        padding: 40px 30px; 
        text-align: center; 
        border-top: 1px solid #e2e8f0;
      }
      .email-footer p { 
        margin: 8px 0; 
        font-size: 14px; 
        color: #64748b; 
        line-height: 1.6;
      }
      .email-footer strong { 
        color: #334155; 
        font-weight: 600;
      }
      
      /* Utility classes */
      .highlight { 
        color: #dc2626; 
        font-weight: 700; 
        background: rgba(220, 38, 38, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
      }
      .text-center { text-align: center; }
      .mb-4 { margin-bottom: 24px; }
      
      /* Mobile responsiveness */
      @media only screen and (max-width: 640px) {
        .email-wrapper { padding: 20px 10px; }
        .email-content { padding: 30px 20px; }
        .email-header { padding: 30px 20px; }
        .email-header h1 { font-size: 28px; }
        .email-content h2 { font-size: 24px; }
        .otp-code { 
          font-size: 36px; 
          letter-spacing: 4px; 
          padding: 15px;
        }
        .otp-container { padding: 30px 15px; }
      }
      
      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .email-container { 
          background: #1f2937; 
          border-color: #374151;
        }
        .email-content { background: #1f2937; }
        .email-content h2 { color: #f9fafb; }
        .email-content p { color: #d1d5db; }
        .email-footer { background: #111827; border-color: #374151; }
        .email-footer p { color: #9ca3af; }
        .email-footer strong { color: #f3f4f6; }
      }
    </style>
  `;

  const templates = {
    verification: {
      subject: "🎉 Verify Your Email - Lion Bidi",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <title>Email Verification - Lion Bidi</title>
          ${baseStyles}
        </head>
        <body>
          <div class="email-wrapper">
            <div class="email-container">
              <div class="email-header">
                <img src="https://res.cloudinary.com/dxqerqng1/image/upload/v1754660338/campaign_covers/brixv4aazfsuzq27kfbc.png" alt="Lion Bidi" class="logo">
                <h1>Lion Bidi</h1>
                <p>Premium Quality Products</p>
              </div>
              
              <div class="email-content">
                <h2>🎉 Welcome to Lion Bidi!</h2>
                <p>Thank you for joining our premium community. We're excited to have you on board! Please verify your email address to complete your registration and unlock access to our exclusive products.</p>
                
                <div class="otp-container">
                  <h3>Your Verification Code</h3>
                  <div class="otp-code">${otp}</div>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 16px;">Enter this code in the app to verify your email</p>
                </div>
                
                <div class="alert-box">
                  <strong>This code expires in 10 minutes</strong> for your security.<br>
                  <small style="color: #92400e;">If you didn't create an account, please ignore this email.</small>
                </div>
                
                <p style="font-size: 14px; color: #9ca3af;">Having trouble? Contact our support team and we'll be happy to help!</p>
              </div>
              
              <div class="email-footer">
                <p><strong>© 2024 Lion Bidi</strong> - Premium Quality Products</p>
                <p>This is an automated message, please do not reply to this email.</p>
                <p style="margin-top: 20px;">🌟 <strong>Thank you for choosing Lion Bidi!</strong> 🌟</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    },

    login: {
      subject: "🔐 Secure Login Code - Lion Bidi",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <title>Login Code - Lion Bidi</title>
          ${baseStyles}
        </head>
        <body>
          <div class="email-wrapper">
            <div class="email-container">
              <div class="email-header">
                <img src="https://res.cloudinary.com/dxqerqng1/image/upload/v1754660338/campaign_covers/brixv4aazfsuzq27kfbc.png" alt="Lion Bidi" class="logo">
                <h1>Lion Bidi</h1>
                <p>Premium Quality Products</p>
              </div>
              
              <div class="email-content">
                <h2>🔐 Secure Login Request</h2>
                <p>Someone is attempting to sign in to your Lion Bidi account. If this was you, please use the secure code below to complete your login.</p>
                
                <div class="otp-container">
                  <h3>Your Login Code</h3>
                  <div class="otp-code">${otp}</div>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 16px;">Use this code to complete your secure login</p>
                </div>
                
                <div class="alert-box">
                  <strong>This code expires in 10 minutes</strong> for your security.
                </div>
                
                <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 1px solid #fca5a5; border-radius: 12px; padding: 20px; margin: 30px 0; text-align: left;">
                  <h4 style="color: #dc2626; margin-bottom: 12px; font-size: 16px;">🛡️ Security Notice</h4>
                  <p style="color: #7f1d1d; font-size: 14px; margin: 0;">If you didn't request this login, please secure your account immediately. Consider changing your password and enabling additional security measures.</p>
                </div>
              </div>
              
              <div class="email-footer">
                <p><strong>© 2024 Lion Bidi</strong> - Premium Quality Products</p>
                <p>This is an automated message, please do not reply to this email.</p>
                <p style="margin-top: 20px;">🛡️ <strong>Your security is our priority</strong> 🛡️</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    },

    reset: {
      subject: "🔑 Password Reset Code - Lion Bidi",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <title>Password Reset - Lion Bidi</title>
          ${baseStyles}
        </head>
        <body>
          <div class="email-wrapper">
            <div class="email-container">
              <div class="email-header">
                <img src="https://res.cloudinary.com/dxqerqng1/image/upload/v1754660338/campaign_covers/brixv4aazfsuzq27kfbc.png" alt="Lion Bidi" class="logo">
                <h1>Lion Bidi</h1>
                <p>Premium Quality Products</p>
              </div>
              
              <div class="email-content">
                <h2>🔑 Password Reset Request</h2>
                <p>We received a request to reset the password for your Lion Bidi account. Use the secure code below to create your new password.</p>
                
                <div class="otp-container">
                  <h3>Your Reset Code</h3>
                  <div class="otp-code">${otp}</div>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 16px;">Enter this code to reset your password</p>
                </div>
                
                <div class="alert-box">
                  <strong>This code expires in 5 minutes</strong> for enhanced security.
                </div>
                
                <div class="info-box">
                  <h4 style="color: #1e40af; margin-bottom: 16px; font-size: 16px;">📋 Next Steps:</h4>
                  <ol style="color: #1e40af; margin: 0; padding-left: 24px; font-size: 14px;">
                    <li style="margin: 8px 0;">Return to the Lion Bidi app</li>
                    <li style="margin: 8px 0;">Enter this 6-digit code</li>
                    <li style="margin: 8px 0;">Create your new secure password</li>
                    <li style="margin: 8px 0;">Sign in with your new password</li>
                  </ol>
                </div>
                
                <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 1px solid #fca5a5; border-radius: 12px; padding: 20px; margin: 30px 0; text-align: left;">
                  <h4 style="color: #dc2626; margin-bottom: 12px; font-size: 16px;">🛡️ Security Notice</h4>
                  <p style="color: #7f1d1d; font-size: 14px; margin: 0;">If you didn't request this password reset, please ignore this email. Your password will remain unchanged and your account stays secure.</p>
                </div>
              </div>
              
              <div class="email-footer">
                <p><strong>© 2024 Lion Bidi</strong> - Premium Quality Products</p>
                <p>This is an automated message, please do not reply to this email.</p>
                <p style="margin-top: 20px;">🔒 <strong>Your security is our top priority</strong> 🔒</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    },
  };

  return templates[type] || templates.verification;
};

// Enhanced order email templates with better UI
const getOrderEmailTemplate = (type, data) => {
  const safeData = {
    orderNumber: data?.orderNumber || "Unknown",
    customerName: data?.customerName || "Valued Customer",
    customerEmail: data?.customerEmail || "No email provided",
    amount: data?.amount || 0,
    transactionId: data?.transactionId || "Unknown",
    orderDate: data?.orderDate || new Date(),
    items: Array.isArray(data?.items) ? data.items : [],
    shippingAddress: data?.shippingAddress || {},
    trackingUrl: data?.trackingUrl || "#",
    retryUrl: data?.retryUrl || "#",
    reason: data?.reason || "Unknown reason",
    deletedAt: data?.deletedAt || new Date(),
    deletedBy: data?.deletedBy || "Unknown",
  };

  const orderStyles = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
        line-height: 1.6; 
        color: #1f2937; 
        background-color: #f8fafc;
        margin: 0; padding: 0;
        -webkit-font-smoothing: antialiased;
      }
      .email-wrapper { 
        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); 
        padding: 40px 20px; 
        min-height: 100vh;
      }
      .email-container { 
        max-width: 650px; 
        margin: 0 auto; 
        background: #ffffff; 
        border-radius: 16px; 
        overflow: hidden; 
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        border: 1px solid #e2e8f0;
      }
      .email-header { 
        background: linear-gradient(135deg, #ea580c 0%, #dc2626 50%, #b91c1c 100%); 
        padding: 40px 30px; 
        text-align: center; 
        color: white;
        position: relative;
      }
      .email-header h1 { 
        font-size: 32px; 
        font-weight: 700; 
        margin-bottom: 8px;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      .email-content { padding: 50px 40px; background: #ffffff; }
      .status-card { 
        background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); 
        border: 2px solid #10b981; 
        border-radius: 16px; 
        padding: 30px; 
        margin: 30px 0; 
        text-align: center;
        position: relative;
      }
      .status-card.warning {
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        border-color: #f59e0b;
      }
      .status-card.error {
        background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
        border-color: #ef4444;
      }
      .order-summary { 
        background: #f8fafc; 
        border-radius: 12px; 
        padding: 30px; 
        margin: 30px 0;
        border: 1px solid #e2e8f0;
      }
      .order-items { margin: 25px 0; }
      .item-row { 
        display: flex; 
        justify-content: space-between; 
        align-items: center;
        padding: 16px 0; 
        border-bottom: 1px solid #e5e7eb;
      }
      .item-row:last-child { border-bottom: none; }
      .shipping-info { 
        background: linear-gradient(135deg, #fef2f2 0%, #fdf2f8 100%); 
        border-radius: 12px; 
        padding: 25px; 
        margin: 25px 0;
        border: 1px solid #fecaca;
      }
      .action-button { 
        display: inline-block;
        background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); 
        color: white; 
        padding: 16px 32px; 
        text-decoration: none; 
        border-radius: 10px; 
        font-weight: 600;
        font-size: 16px;
        box-shadow: 0 10px 16px rgba(220, 38, 38, 0.3);
        transition: all 0.3s ease;
      }
      .action-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 20px rgba(220, 38, 38, 0.4);
      }
      .email-footer { 
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); 
        padding: 40px 30px; 
        text-align: center; 
        border-top: 1px solid #e2e8f0;
      }
      .total-amount {
        font-size: 24px;
        font-weight: 700;
        color: #dc2626;
        background: rgba(220, 38, 38, 0.1);
        padding: 12px 20px;
        border-radius: 8px;
        display: inline-block;
        margin: 10px 0;
      }
      @media only screen and (max-width: 640px) {
        .email-wrapper { padding: 20px 10px; }
        .email-content { padding: 30px 20px; }
        .item-row { flex-direction: column; align-items: flex-start; }
        .action-button { display: block; text-align: center; margin: 20px 0; }
      }
    </style>
  `;

  const templates = {
    admin_payment_verification: {
      subject: `🔍 Payment Verification Required - Order ${safeData.orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Verification Required</title>
          ${orderStyles}
        </head>
        <body>
          <div class="email-wrapper">
            <div class="email-container">
              <div class="email-header">
                <h1>🔍 Payment Verification Required</h1>
                <p>Lion Bidi Admin Dashboard</p>
              </div>
              
              <div class="email-content">
                <div class="status-card warning">
                  <h2 style="color: #92400e; margin-bottom: 16px;">⚠️ Action Required</h2>
                  <p style="color: #92400e; font-size: 18px;">A new payment submission requires your verification.</p>
                </div>
                
                <div class="order-summary">
                  <h3 style="color: #111827; margin-bottom: 20px;">📋 Order Details</h3>
                  <p><strong>Order Number:</strong> ${safeData.orderNumber}</p>
                  <p><strong>Customer:</strong> ${safeData.customerName}</p>
                  <p><strong>Email:</strong> ${safeData.customerEmail}</p>
                  <div class="total-amount">₹${safeData.amount.toFixed(2)}</div>
                  <p><strong>Transaction ID:</strong> ${safeData.transactionId}</p>
                  <p><strong>Date:</strong> ${new Date(safeData.orderDate).toLocaleString('en-IN')}</p>
                </div>
                
                <div class="order-items">
                  <h3 style="margin-bottom: 20px;">📦 Items Ordered</h3>
                  ${safeData.items.length > 0 
                    ? safeData.items.map(item => `
                        <div class="item-row">
                          <div>
                            <strong>${item?.name || "Unknown Item"}</strong><br>
                            <small style="color: #6b7280;">Quantity: ${item?.quantity || 0}</small>
                          </div>
                          <div style="font-weight: 600;">₹${((item?.price || 0) * (item?.quantity || 0)).toFixed(2)}</div>
                        </div>
                      `).join('')
                    : '<p style="text-align: center; color: #6b7280;">No items found</p>'
                  }
                </div>
                
                <div style="text-align: center; margin-top: 40px;">
                  <a href="${process.env.ADMIN_PANEL_URL || 'http://localhost:3000'}/admin/payment-verification" class="action-button">
                    🚀 Review Payment
                  </a>
                </div>
              </div>
              
              <div class="email-footer">
                <p><strong>© 2024 Lion Bidi</strong> - Admin Notification System</p>
                <p style="color: #64748b; font-size: 14px;">This is an automated notification. Please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    },

    admin_new_order: {
      subject: `🔔 New Order Alert - ${safeData.orderNumber} | Lion Bidi`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Order Alert</title>
          ${orderStyles}
        </head>
        <body>
          <div class="email-wrapper">
            <div class="email-container">
              <div class="email-header">
                <h1>🔔 New Order Received!</h1>
                <p>Lion Bidi Admin Notification</p>
              </div>
              
              <div class="email-content">
                <div class="status-card">
                  <h2 style="color: #065f46; margin-bottom: 16px;">⚡ New Order Alert</h2>
                  <p style="color: #065f46; font-size: 18px;">A customer has placed a new order that requires your attention.</p>
                  <div style="margin-top: 20px;">
                    <strong style="font-size: 20px; color: #065f46;">Order: ${safeData.orderNumber}</strong>
                  </div>
                </div>
                
                <div class="order-summary">
                  <h3 style="color: #111827; margin-bottom: 20px;">📋 Order Summary</h3>
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div>
                      <p><strong>Customer:</strong><br>${safeData.customerName}</p>
                      <p><strong>Email:</strong><br>${safeData.customerEmail}</p>
                    </div>
                    <div>
                      <p><strong>Order Date:</strong><br>${new Date(safeData.orderDate).toLocaleString('en-IN')}</p>
                      <div class="total-amount">₹${safeData.amount.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
                
                <div class="order-items">
                  <h3 style="margin-bottom: 20px;">📦 Items Ordered</h3>
                  ${safeData.items.length > 0 
                    ? safeData.items.map(item => `
                        <div class="item-row">
                          <div>
                            <strong>${item?.name || "Unknown Item"}</strong><br>
                            <small style="color: #6b7280;">Quantity: ${item?.quantity || 0} × ₹${(item?.price || 0).toFixed(2)}</small>
                          </div>
                          <div style="font-weight: 700; color: #dc2626;">₹${((item?.price || 0) * (item?.quantity || 0)).toFixed(2)}</div>
                        </div>
                      `).join('')
                    : '<p style="text-align: center; color: #6b7280;">No items found</p>'
                  }
                </div>
                
                <div style="text-align: center; margin-top: 40px;">
                  <a href="${process.env.ADMIN_PANEL_URL || 'http://localhost:3000'}/admin/orders" class="action-button">
                    🚀 Go to Admin Panel
                  </a>
                </div>
                
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 20px; margin-top: 30px; text-align: center;">
                  <p style="color: #1e40af; font-size: 14px; margin: 0;">
                    💡 <strong>Next Steps:</strong> The customer will submit payment details shortly. Please monitor the admin panel for payment verification requests.
                  </p>
                </div>
              </div>
              
              <div class="email-footer">
                <p><strong>© 2024 Lion Bidi</strong> - Admin Notification System</p>
                <p style="color: #64748b; font-size: 14px;">This is an automated notification. Please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    },

    admin_order_deleted: {
      subject: `🗑️ Order Deleted - ${safeData.orderNumber} | Lion Bidi Admin Alert`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Deleted Alert</title>
          ${orderStyles}
        </head>
        <body>
          <div class="email-wrapper">
            <div class="email-container">
              <div class="email-header" style="background: linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%);">
                <h1>🗑️ Order Deletion Alert</h1>
                <p>Lion Bidi Admin Notification</p>
              </div>
              
              <div class="email-content">
                <div class="status-card error">
                  <h2 style="color: #7f1d1d; margin-bottom: 16px;">⚠️ Order Deleted</h2>
                  <p style="color: #7f1d1d; font-size: 18px;">A customer has deleted their order from the system.</p>
                  <div style="margin-top: 20px;">
                    <strong style="font-size: 20px; color: #7f1d1d;">Order: ${safeData.orderNumber}</strong>
                  </div>
                </div>
                
                <div class="order-summary">
                  <h3 style="color: #111827; margin-bottom: 20px;">📋 Deletion Details</h3>
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div>
                      <p><strong>Customer:</strong><br>${safeData.customerName}</p>
                      <p><strong>Email:</strong><br>${safeData.customerEmail}</p>
                      <p><strong>Order Number:</strong><br>${safeData.orderNumber}</p>
                    </div>
                    <div>
                      <p><strong>Deleted At:</strong><br>${new Date(safeData.deletedAt).toLocaleString('en-IN')}</p>
                      <p><strong>Deleted By:</strong><br>${safeData.deletedBy}</p>
                    </div>
                  </div>
                </div>
                
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 25px; margin: 30px 0; text-align: center;">
                  <h4 style="color: #dc2626; margin-bottom: 12px;">📋 Order Status</h4>
                  <p style="color: #7f1d1d; margin: 0;">This order has been permanently deleted by the customer and removed from the active order system.</p>
                </div>
              </div>
              
              <div class="email-footer">
                <p><strong>© 2024 Lion Bidi</strong> - Admin Notification System</p>
                <p style="color: #64748b; font-size: 14px;">This is an automated notification. Please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    },

    order_confirmed: {
      subject: `✅ Order Confirmed - ${safeData.orderNumber} | Lion Bidi`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmed</title>
          ${orderStyles}
        </head>
        <body>
          <div class="email-wrapper">
            <div class="email-container">
              <div class="email-header">
                <h1>✅ Order Confirmed!</h1>
                <p>Lion Bidi - Premium Quality</p>
              </div>
              
              <div class="email-content">
                <div class="status-card">
                  <h2 style="color: #065f46; margin-bottom: 16px;">🎉 Thank you, ${safeData.customerName}!</h2>
                  <p style="color: #065f46; font-size: 18px;">Your order has been confirmed and is now being processed with care.</p>
                  <div style="margin-top: 20px;">
                    <strong style="font-size: 20px; color: #065f46;">Order #${safeData.orderNumber}</strong>
                  </div>
                </div>
                
                <div class="order-summary">
                  <h3 style="color: #111827; margin-bottom: 20px;">📋 Order Summary</h3>
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div>
                      <p><strong>Order Number:</strong><br>${safeData.orderNumber}</p>
                      <p><strong>Order Date:</strong><br>${new Date(safeData.orderDate).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <div class="total-amount">₹${safeData.amount.toFixed(2)}</div>
                      <p style="color: #6b7280; font-size: 14px; margin-top: 10px;">Total Amount</p>
                    </div>
                  </div>
                </div>
                
                <div class="order-items">
                  <h3 style="margin-bottom: 20px;">📦 Items Ordered</h3>
                  ${safeData.items.length > 0 
                    ? safeData.items.map(item => `
                        <div class="item-row">
                          <div>
                            <strong style="font-size: 16px;">${item?.name || "Unknown Item"}</strong><br>
                            <small style="color: #6b7280;">Qty: ${item?.quantity || 0} × ₹${(item?.price || 0).toFixed(2)} each</small>
                          </div>
                          <div style="font-weight: 700; color: #dc2626; font-size: 18px;">₹${((item?.price || 0) * (item?.quantity || 0)).toFixed(2)}</div>
                        </div>
                      `).join('')
                    : '<p style="text-align: center; color: #6b7280;">No items found</p>'
                  }
                </div>
                
                <div class="shipping-info">
                  <h3 style="color: #111827; margin-bottom: 16px;">🚚 Shipping Address</h3>
                  <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #fecaca;">
                    <p style="font-weight: 600; color: #111827; margin-bottom: 8px;">${safeData.shippingAddress?.name || "Address Holder"}</p>
                    <p style="color: #4b5563;">${safeData.shippingAddress?.street || "Street Address"}</p>
                    <p style="color: #4b5563;">${safeData.shippingAddress?.city || "City"}, ${safeData.shippingAddress?.state || "State"} - ${safeData.shippingAddress?.zipCode || "ZIP"}</p>
                    <p style="color: #4b5563;"><strong>Phone:</strong> ${safeData.shippingAddress?.phone || "Not provided"}</p>
                  </div>
                </div>
                
                <div style="text-align: center; margin: 40px 0;">
                  <a href="${safeData.trackingUrl}" class="action-button">
                    📍 Track Your Order
                  </a>
                </div>
                
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 25px; margin: 30px 0;">
                  <h4 style="color: #1e40af; margin-bottom: 16px;">📅 What's Next?</h4>
                  <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
                    <li style="margin: 8px 0;">We'll process your order within 24 hours</li>
                    <li style="margin: 8px 0;">You'll receive tracking information once shipped</li>
                    <li style="margin: 8px 0;">Estimated delivery: 5-7 business days</li>
                    <li style="margin: 8px 0;">Our support team is here if you need help</li>
                  </ul>
                </div>
              </div>
              
              <div class="email-footer">
                <p><strong>© 2024 Lion Bidi</strong> - Premium Quality Products</p>
                <p style="color: #64748b; font-size: 14px;">Need help? Contact us at <a href="mailto:lionbidicompany@gmail.com" style="color: #dc2626;">lionbidicompany@gmail.com</a></p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    },

    payment_failed: {
      subject: `❌ Payment Issue - Order ${safeData.orderNumber} | Lion Bidi`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Issue</title>
          ${orderStyles}
        </head>
        <body>
          <div class="email-wrapper">
            <div class="email-container">
              <div class="email-header" style="background: linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%);">
                <h1>❌ Payment Issue</h1>
                <p>Lion Bidi - Premium Quality</p>
              </div>
              
              <div class="email-content">
                <div class="status-card error">
                  <h2 style="color: #7f1d1d; margin-bottom: 16px;">⚠️ Payment Verification Failed</h2>
                  <p style="color: #7f1d1d; font-size: 18px;">We encountered an issue while verifying your payment for order ${safeData.orderNumber}.</p>
                </div>
                
                <div class="order-summary">
                  <h3 style="color: #111827; margin-bottom: 20px;">📋 Order Details</h3>
                  <p><strong>Order Number:</strong> ${safeData.orderNumber}</p>
                  <p><strong>Amount:</strong> <span class="total-amount">₹${safeData.amount.toFixed(2)}</span></p>
                  <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="color: #7f1d1d; margin: 0;"><strong>Issue Reason:</strong> ${safeData.reason}</p>
                  </div>
                </div>
                
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 25px; margin: 30px 0;">
                  <h4 style="color: #1e40af; margin-bottom: 16px;">🔧 How to Resolve</h4>
                  <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
                    <li style="margin: 8px 0;">Double-check your payment details</li>
                    <li style="margin: 8px 0;">Ensure sufficient funds in your account</li>
                    <li style="margin: 8px 0;">Try a different payment method</li>
                    <li style="margin: 8px 0;">Contact our support team for assistance</li>
                  </ul>
                </div>
                
                <div style="text-align: center; margin: 40px 0;">
                  <a href="${safeData.retryUrl}" class="action-button">
                    🔄 Retry Payment
                  </a>
                </div>
                
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 20px; margin: 30px 0; text-align: center;">
                  <p style="color: #7f1d1d; margin: 0;">
                    <strong>Need Help?</strong> Our support team is ready to assist you with any payment issues.
                  </p>
                </div>
              </div>
              
              <div class="email-footer">
                <p><strong>© 2024 Lion Bidi</strong> - Premium Quality Products</p>
                <p style="color: #64748b; font-size: 14px;">
                  Need help? Contact us at <a href="mailto:lionbidicompany@gmail.com" style="color: #dc2626;">lionbidicompany@gmail.com</a> 
                  or call <a href="tel:+919589773525" style="color: #dc2626;">+91-9589773525</a>
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    },
  };

  return templates[type] || templates.order_confirmed;
};

// Enhanced send email function with retry logic
const sendEmailOTP = async (email, otp, type = "verification", retryCount = 0) => {
  const maxRetries = 3;

  try {
    console.log(`Attempting to send ${type} email to:`, email, `(Attempt ${retryCount + 1})`);

    const transporter = createTransporter();
    const template = getEmailTemplate(otp, type);

    const mailOptions = {
      from: `"Lion Bidi - Premium Quality" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: template.subject,
      html: template.html,
      headers: {
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        Importance: "High",
      },
    };

    console.log("Sending email with options:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });

    const result = await transporter.sendMail(mailOptions);

    console.log("Email sent successfully:", {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      response: result.response,
    });

    return result;
  } catch (error) {
    console.error(`Send email error (Attempt ${retryCount + 1}):`, {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    if (
      retryCount < maxRetries &&
      (error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ENOTFOUND" ||
        error.message.includes("timeout"))
    ) {
      console.log(`Retrying email send in ${(retryCount + 1) * 2} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, (retryCount + 1) * 2000));
      return sendEmailOTP(email, otp, type, retryCount + 1);
    }

    throw new Error(`Failed to send email after ${retryCount + 1} attempts: ${error.message}`);
  }
};

// Enhanced test email function
const testEmailService = async (testEmail = null) => {
  try {
    console.log("Testing email service...");

    const targetEmail = testEmail || process.env.EMAIL_USER || "test@example.com";
    const testOtp = generateOTP();

    console.log(`Sending test email to: ${targetEmail}`);

    const result = await sendEmailOTP(targetEmail, testOtp, "verification");

    console.log("Email service test successful:", {
      messageId: result.messageId,
      targetEmail,
      testOtp,
    });

    return {
      success: true,
      messageId: result.messageId,
      targetEmail,
      testOtp,
    };
  } catch (error) {
    console.error("Email service test failed:", error.message);
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
};

// Validate email configuration
const validateEmailConfig = () => {
  const requiredEnvVars = ["EMAIL_USER", "EMAIL_PASS"];
  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  console.log("Email configuration validated successfully");
  return true;
};

// Email rate limiting helper
const emailRateLimit = new Map();

const checkEmailRateLimit = (email, type = "general") => {
  const key = `${email}:${type}`;
  const now = Date.now();
  const minute = 60 * 1000;

  if (!emailRateLimit.has(key)) {
    emailRateLimit.set(key, []);
  }

  const attempts = emailRateLimit.get(key);
  const recentAttempts = attempts.filter((time) => now - time < minute);

  if (recentAttempts.length >= 3) {
    return false;
  }

  recentAttempts.push(now);
  emailRateLimit.set(key, recentAttempts);
  return true;
};

module.exports = {
  generateOTP,
  sendEmailOTP,
  sendOrderNotificationEmail,
  testEmailService,
  createTransporter,
  validateEmailConfig,
  checkEmailRateLimit,
};