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

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    pool: true, // Enable connection pooling
    maxConnections: 5,
    maxMessages: 100,
  });

  // Verify connection on creation
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

// Enhanced email templates with better mobile responsiveness
const getEmailTemplate = (otp, type = "verification") => {
  const templates = {
    verification: {
      subject: "Verify Your Email - Lion Bidi",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification - Lion Bidi</title>
          <style>
            @media only screen and (max-width: 600px) {
              .container { width: 100% !important; }
              .content { padding: 20px !important; }
              .otp { font-size: 24px !important; letter-spacing: 2px !important; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #ea580c, #dc2626, #ea580c); padding: 30px 20px; text-align: center; }
            .header h1 { color: white; margin: 10px 0 5px 0; font-size: 28px; font-weight: bold; }
            .header p { color: #fef2f2; margin: 0; font-size: 14px; font-weight: 500; }
            .content { padding: 40px 30px; text-align: center; }
            .content h2 { color: #1f2937; margin-bottom: 10px; font-size: 24px; }
            .content p { color: #6b7280; margin-bottom: 20px; font-size: 16px; }
            .otp-box { background: linear-gradient(135deg, #fef2f2, #fdf2f8); border: 2px solid #fecaca; border-radius: 12px; padding: 25px; margin: 30px 0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }
            .otp-box h3 { color: #374151; margin-bottom: 15px; font-size: 18px; }
            .otp { font-size: 36px; font-weight: bold; color: #dc2626; letter-spacing: 6px; font-family: 'Courier New', monospace; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1); }
            .footer { background-color: #f9fafb; padding: 25px 20px; text-align: center; }
            .footer p { margin: 5px 0; font-size: 12px; color: #6b7280; }
            .highlight { color: #dc2626; font-weight: 600; }
            .logo { height: 40px; width: 40px; display: inline-block; margin-bottom: 10px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img
                src="https://res.cloudinary.com/dxqerqng1/image/upload/v1754660338/campaign_covers/brixv4aazfsuzq27kfbc.png"
                alt="Lion Bidi"
                class="logo"
              />
              <h1>Lion Bidi</h1>
              <p>Premium Quality</p>
            </div>
            <div class="content">
              <h2>🎉 Welcome to Lion Bidi!</h2>
              <p>Thank you for joining our premium community. Please verify your email address to complete your registration and start shopping.</p>
              
              <div class="otp-box">
                <h3>Your Verification Code</h3>
                <div class="otp">${otp}</div>
              </div>
              
              <p><span class="highlight">⏰ This code expires in 10 minutes</span> for your security.</p>
              <p style="font-size: 14px; color: #9ca3af;">If you didn't create an account, please ignore this email.</p>
            </div>
            <div class="footer">
              <p><strong>© 2024 Lion Bidi</strong> - Premium Quality Products</p>
              <p>This is an automated message, please do not reply to this email.</p>
              <p style="margin-top: 15px;">🌟 Thank you for choosing Lion Bidi! 🌟</p>
            </div>
          </div>
        </body>
        </html>
      `,
    },
    login: {
      subject: "🔐 Login Code - Lion Bidi",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Login Code - Lion Bidi</title>
          <style>
            @media only screen and (max-width: 600px) {
              .container { width: 100% !important; }
              .content { padding: 20px !important; }
              .otp { font-size: 24px !important; letter-spacing: 2px !important; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #ea580c, #dc2626, #ea580c); padding: 30px 20px; text-align: center; }
            .header h1 { color: white; margin: 10px 0 5px 0; font-size: 28px; font-weight: bold; }
            .header p { color: #fef2f2; margin: 0; font-size: 14px; font-weight: 500; }
            .content { padding: 40px 30px; text-align: center; }
            .content h2 { color: #1f2937; margin-bottom: 10px; font-size: 24px; }
            .content p { color: #6b7280; margin-bottom: 20px; font-size: 16px; }
            .otp-box { background: linear-gradient(135deg, #fef2f2, #fdf2f8); border: 2px solid #fecaca; border-radius: 12px; padding: 25px; margin: 30px 0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }
            .otp-box h3 { color: #374151; margin-bottom: 15px; font-size: 18px; }
            .otp { font-size: 36px; font-weight: bold; color: #dc2626; letter-spacing: 6px; font-family: 'Courier New', monospace; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1); }
            .footer { background-color: #f9fafb; padding: 25px 20px; text-align: center; }
            .footer p { margin: 5px 0; font-size: 12px; color: #6b7280; }
            .warning { background: linear-gradient(135deg, #fef3c7, #fde68a); border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0; }
            .warning strong { color: #92400e; }
            .highlight { color: #dc2626; font-weight: 600; }
            .logo { height: 40px; width: 40px; display: inline-block; margin-bottom: 10px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img
                src="https://res.cloudinary.com/dxqerqng1/image/upload/v1754660338/campaign_covers/brixv4aazfsuzq27kfbc.png"
                alt="Lion Bidi"
                class="logo"
              />
              <h1>Lion Bidi</h1>
              <p>Premium Quality</p>
            </div>
            <div class="content">
              <h2>🔐 Login Request</h2>
              <p>Someone is trying to sign in to your Lion Bidi account. If this was you, use the code below:</p>
              
              <div class="otp-box">
                <h3>Your Login Code</h3>
                <div class="otp">${otp}</div>
              </div>
              
              <p><span class="highlight">⏰ This code expires in 10 minutes</span> for your security.</p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong><br>
                If you didn't request this login, please secure your account immediately and consider changing your password.
              </div>
            </div>
            <div class="footer">
              <p><strong>© 2024 Lion Bidi</strong> - Premium Quality Products</p>
              <p>This is an automated message, please do not reply to this email.</p>
              <p style="margin-top: 15px;">🛡️ Your security is our priority 🛡️</p>
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
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - Lion Bidi</title>
          <style>
            @media only screen and (max-width: 600px) {
              .container { width: 100% !important; }
              .content { padding: 20px !important; }
              .otp { font-size: 24px !important; letter-spacing: 2px !important; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #ea580c, #dc2626, #ea580c); padding: 30px 20px; text-align: center; }
            .header h1 { color: white; margin: 10px 0 5px 0; font-size: 28px; font-weight: bold; }
            .header p { color: #fef2f2; margin: 0; font-size: 14px; font-weight: 500; }
            .content { padding: 40px 30px; text-align: center; }
            .content h2 { color: #1f2937; margin-bottom: 10px; font-size: 24px; }
            .content p { color: #6b7280; margin-bottom: 20px; font-size: 16px; }
            .otp-box { background: linear-gradient(135deg, #fef2f2, #fdf2f8); border: 2px solid #fecaca; border-radius: 12px; padding: 25px; margin: 30px 0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }
            .otp-box h3 { color: #374151; margin-bottom: 15px; font-size: 18px; }
            .otp { font-size: 36px; font-weight: bold; color: #dc2626; letter-spacing: 6px; font-family: 'Courier New', monospace; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1); }
            .footer { background-color: #f9fafb; padding: 25px 20px; text-align: center; }
            .footer p { margin: 5px 0; font-size: 12px; color: #6b7280; }
            .warning { background: linear-gradient(135deg, #fef3c7, #fde68a); border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0; }
            .warning strong { color: #92400e; }
            .highlight { color: #dc2626; font-weight: 600; }
            .steps { background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: left; }
            .steps ol { margin: 0; padding-left: 20px; color: #1e40af; }
            .steps li { margin: 8px 0; }
            .logo { height: 40px; width: 40px; display: inline-block; margin-bottom: 10px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img
                src="https://res.cloudinary.com/dxqerqng1/image/upload/v1754660338/campaign_covers/brixv4aazfsuzq27kfbc.png"
                alt="Lion Bidi"
                class="logo"
              />
              <h1>Lion Bidi</h1>
              <p>Premium Quality</p>
            </div>
            <div class="content">
              <h2>🔑 Password Reset Request</h2>
              <p>You requested to reset your password for your Lion Bidi account. Use the code below to create a new password:</p>
              
              <div class="otp-box">
                <h3>Your Reset Code</h3>
                <div class="otp">${otp}</div>
              </div>
              
              <p><span class="highlight">⏰ This code expires in 5 minutes</span> for enhanced security.</p>
              
              <div class="steps">
                <strong>Next Steps:</strong>
                <ol>
                  <li>Return to the Lion Bidi app</li>
                  <li>Enter this 6-digit code</li>
                  <li>Create your new secure password</li>
                  <li>Sign in with your new password</li>
                </ol>
              </div>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong><br>
                If you didn't request this password reset, please ignore this email. Your password will remain unchanged and your account stays secure.
              </div>
            </div>
            <div class="footer">
              <p><strong>© 2024 Lion Bidi</strong> - Premium Quality Products</p>
              <p>This is an automated message, please do not reply to this email.</p>
              <p style="margin-top: 15px;">🔒 Your security is our top priority 🔒</p>
            </div>
          </div>
        </body>
        </html>
      `,
    },
  };

  return templates[type] || templates.verification;
};

// Fixed getOrderEmailTemplate function for utils/emailService.js
const getOrderEmailTemplate = (type, data) => {
  // Add safety checks for data
  const safeData = {
    orderNumber: data?.orderNumber || "Unknown",
    customerName: data?.customerName || "Unknown Customer",
    customerEmail: data?.customerEmail || "No email provided",
    amount: data?.amount || 0,
    transactionId: data?.transactionId || "Unknown",
    orderDate: data?.orderDate || new Date(),
    items: Array.isArray(data?.items) ? data.items : [],
    shippingAddress: data?.shippingAddress || {},
    trackingUrl: data?.trackingUrl || "#",
    retryUrl: data?.retryUrl || "#",
    reason: data?.reason || "Unknown reason",
  };

  const templates = {
    admin_payment_verification: {
      subject: `🔍 Payment Verification Required - Order ${safeData.orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Verification Required - Lion Bidi</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #ea580c, #dc2626, #ea580c); padding: 30px 20px; text-align: center; color: white; }
            .content { padding: 30px; }
            .alert { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .order-details { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .items { margin: 15px 0; }
            .item { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔍 Payment Verification Required</h1>
              <p>Lion Bidi Admin Dashboard</p>
            </div>
            <div class="content">
              <div class="alert">
                <h3>⚠️ Action Required</h3>
                <p>A new payment submission requires verification.</p>
              </div>
              
              <div class="order-details">
                <h3>Order Details</h3>
                <p><strong>Order Number:</strong> ${safeData.orderNumber}</p>
                <p><strong>Customer:</strong> ${safeData.customerName}</p>
                <p><strong>Email:</strong> ${safeData.customerEmail}</p>
                <p><strong>Amount:</strong> ₹${safeData.amount.toFixed(2)}</p>
                <p><strong>Transaction ID:</strong> ${
                  safeData.transactionId
                }</p>
                <p><strong>Order Date:</strong> ${new Date(
                  safeData.orderDate
                ).toLocaleString()}</p>
              </div>
              
              <div class="items">
                <h3>Items Ordered</h3>
                ${
                  safeData.items.length > 0
                    ? safeData.items
                        .map(
                          (item) => `
                    <div class="item">
                      <strong>${item?.name || "Unknown Item"}</strong> × ${
                            item?.quantity || 0
                          } = ₹${(
                            (item?.price || 0) * (item?.quantity || 0)
                          ).toFixed(2)}
                    </div>
                  `
                        )
                        .join("")
                    : '<div class="item">No items found</div>'
                }
              </div>
            </div>
            <div class="footer">
              <p>© 2024 Lion Bidi - Admin Notification</p>
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
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Order Alert - Lion Bidi Admin</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #ea580c, #dc2626); padding: 30px 20px; text-align: center; color: white; }
            .content { padding: 30px; }
            .alert { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
            .order-details { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .action-button { background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
            .items { margin: 15px 0; }
            .item { padding: 10px 0; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; }
            .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 New Order Received!</h1>
              <p>Lion Bidi Admin Notification</p>
            </div>
            
            <div class="content">
              <div class="alert">
                <h2>⚡ Action Required</h2>
                <p>A new order has been placed and requires your attention.</p>
                <p><strong>Order: ${safeData.orderNumber}</strong></p>
                <p><strong>Amount: ₹${safeData.amount.toFixed(2)}</strong></p>
              </div>
              
              <div class="order-details">
                <h3>📋 Order Summary</h3>
                <p><strong>Customer:</strong> ${safeData.customerName}</p>
                <p><strong>Email:</strong> ${safeData.customerEmail}</p>
                <p><strong>Order Date:</strong> ${new Date(
                  safeData.orderDate
                ).toLocaleString("en-IN")}</p>
                <p><strong>Total Amount:</strong> ₹${safeData.amount.toFixed(
                  2
                )}</p>
                
                <div class="items">
                  <h4>Items Ordered:</h4>
                  ${
                    safeData.items.length > 0
                      ? safeData.items
                          .map(
                            (item) => `
                      <div class="item">
                        <span><strong>${
                          item?.name || "Unknown Item"
                        }</strong> × ${item?.quantity || 0}</span>
                        <span>₹${(
                          (item?.price || 0) * (item?.quantity || 0)
                        ).toFixed(2)}</span>
                      </div>
                    `
                          )
                          .join("")
                      : "<p>No items found</p>"
                  }
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${
                  process.env.ADMIN_PANEL_URL || "http://localhost:3000"
                }/admin/payment-verification" 
                   class="action-button">
                  🚀 Go to Admin Panel
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; text-align: center;">
                The customer will submit payment details shortly. Please monitor the admin panel for payment verification requests.
              </p>
            </div>
            
            <div class="footer">
              <p><strong>© 2024 Lion Bidi</strong> - Admin Notification System</p>
              <p>This is an automated notification. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    },

    // Add this template to your existing getOrderEmailTemplate function in the templates object

    admin_order_deleted: {
      subject: `🗑️ Order Deleted - ${safeData.orderNumber} | Lion Bidi Admin Alert`,
      html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Deleted - Lion Bidi Admin</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #dc2626, #7f1d1d); padding: 30px 20px; text-align: center; color: white; }
        .content { padding: 30px; }
        .alert { background: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
        .order-details { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🗑️ Order Deletion Alert</h1>
          <p>Lion Bidi Admin Notification</p>
        </div>
        
        <div class="content">
          <div class="alert">
            <h2>⚠️ Order Deleted</h2>
            <p>A customer has deleted their order.</p>
            <p><strong>Order: ${safeData.orderNumber}</strong></p>
          </div>
          
          <div class="order-details">
            <h3>📋 Deletion Details</h3>
            <p><strong>Customer:</strong> ${safeData.customerName}</p>
            <p><strong>Email:</strong> ${safeData.customerEmail}</p>
            <p><strong>Order Number:</strong> ${safeData.orderNumber}</p>
            <p><strong>Deleted At:</strong> ${
              safeData.deletedAt
                ? new Date(safeData.deletedAt).toLocaleString("en-IN")
                : "Unknown"
            }</p>
            <p><strong>User ID:</strong> ${safeData.deletedBy || "Unknown"}</p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; text-align: center;">
            This order was deleted by the customer and has been removed from the system.
          </p>
        </div>
        
        <div class="footer">
          <p><strong>© 2025 Lion Bidi</strong> - Admin Notification System</p>
          <p>This is an automated notification. Please do not reply to this email.</p>
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
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmed - Lion Bidi</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #ea580c, #dc2626, #ea580c); padding: 30px 20px; text-align: center; color: white; }
            .content { padding: 30px; }
            .success { background: #d1fae5; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
            .order-details { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .items { margin: 15px 0; }
            .item { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .shipping-info { background: #fef2f2; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .track-button { background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
            .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Order Confirmed!</h1>
              <p>Lion Bidi - Premium Quality</p>
            </div>
            <div class="content">
              <div class="success">
                <h2>🎉 Thank you, ${safeData.customerName}!</h2>
                <p>Your order has been confirmed and is being processed.</p>
              </div>
              
              <div class="order-details">
                <h3>Order Summary</h3>
                <p><strong>Order Number:</strong> ${safeData.orderNumber}</p>
                <p><strong>Order Date:</strong> ${new Date(
                  safeData.orderDate
                ).toLocaleString()}</p>
                <p><strong>Total Amount:</strong> ₹${safeData.amount.toFixed(
                  2
                )}</p>
              </div>
              
              <div class="items">
                <h3>Items Ordered</h3>
                ${
                  safeData.items.length > 0
                    ? safeData.items
                        .map(
                          (item) => `
                    <div class="item">
                      <strong>${item?.name || "Unknown Item"}</strong><br>
                      Quantity: ${item?.quantity || 0} × ₹${(
                            item?.price || 0
                          ).toFixed(2)} = ₹${(
                            (item?.price || 0) * (item?.quantity || 0)
                          ).toFixed(2)}
                    </div>
                  `
                        )
                        .join("")
                    : '<div class="item">No items found</div>'
                }
              </div>
              
              <div class="shipping-info">
                <h3>📦 Shipping Address</h3>
                <p><strong>${
                  safeData.shippingAddress?.name || "Unknown"
                }</strong></p>
                <p>${
                  safeData.shippingAddress?.street || "Address not provided"
                }</p>
                <p>${safeData.shippingAddress?.city || "City"}, ${
        safeData.shippingAddress?.state || "State"
      } - ${safeData.shippingAddress?.zipCode || "ZIP"}</p>
                <p>Phone: ${
                  safeData.shippingAddress?.phone || "Not provided"
                }</p>
              </div>
              
              <div style="text-align: center;">
                <a href="${
                  safeData.trackingUrl
                }" class="track-button">Track Your Order</a>
              </div>
              
              <p><strong>Estimated Delivery:</strong> 5-7 business days</p>
              <p>You will receive tracking information once your order ships.</p>
            </div>
            <div class="footer">
              <p>© 2024 Lion Bidi - Premium Quality Products</p>
              <p>Need help? Contact us at support@lionbidi.com</p>
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
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Issue - Lion Bidi</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #ea580c, #dc2626, #ea580c); padding: 30px 20px; text-align: center; color: white; }
            .content { padding: 30px; }
            .error { background: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .order-details { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .retry-button { background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
            .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>❌ Payment Issue</h1>
              <p>Lion Bidi - Premium Quality</p>
            </div>
            <div class="content">
              <div class="error">
                <h3>Payment Verification Failed</h3>
                <p>We were unable to verify your payment for order ${
                  safeData.orderNumber
                }.</p>
                <p><strong>Reason:</strong> ${safeData.reason}</p>
              </div>
              
              <div class="order-details">
                <h3>Order Details</h3>
                <p><strong>Order Number:</strong> ${safeData.orderNumber}</p>
                <p><strong>Amount:</strong> ₹${safeData.amount.toFixed(2)}</p>
              </div>
              
              <p>Please try submitting your payment details again or contact our support team for assistance.</p>
              
              <div style="text-align: center;">
                <a href="${
                  safeData.retryUrl
                }" class="retry-button">Retry Payment</a>
              </div>
            </div>
            <div class="footer">
              <p>© 2024 Lion Bidi - Premium Quality Products</p>
              <p>Need help? Contact us at <a href="mailto:lionbidicompany@gmail.com" style="color: #dc2626;">lionbidicompany@gmail.com</a> or call us at +91-9589773525</p>
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
const sendEmailOTP = async (
  email,
  otp,
  type = "verification",
  retryCount = 0
) => {
  const maxRetries = 3;

  try {
    console.log(
      `Attempting to send ${type} email to:`,
      email,
      `(Attempt ${retryCount + 1})`
    );

    const transporter = createTransporter();
    const template = getEmailTemplate(otp, type);

    const mailOptions = {
      from: `"Lion Bidi - Premium Quality" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: template.subject,
      html: template.html,
      // Add additional headers for better deliverability
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

    // Retry logic for transient errors
    if (
      retryCount < maxRetries &&
      (error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ENOTFOUND" ||
        error.message.includes("timeout"))
    ) {
      console.log(`Retrying email send in ${(retryCount + 1) * 2} seconds...`);
      await new Promise((resolve) =>
        setTimeout(resolve, (retryCount + 1) * 2000)
      );
      return sendEmailOTP(email, otp, type, retryCount + 1);
    }

    throw new Error(
      `Failed to send email after ${retryCount + 1} attempts: ${error.message}`
    );
  }
};

// Enhanced test email function with more comprehensive testing
const testEmailService = async (testEmail = null) => {
  try {
    console.log("Testing email service...");

    // Test with provided email or default
    const targetEmail =
      testEmail || process.env.EMAIL_USER || "test@example.com";
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
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  console.log("Email configuration validated successfully");
  return true;
};

// Email rate limiting helper (optional)
const emailRateLimit = new Map();

const checkEmailRateLimit = (email, type = "general") => {
  const key = `${email}:${type}`;
  const now = Date.now();
  const minute = 60 * 1000;

  if (!emailRateLimit.has(key)) {
    emailRateLimit.set(key, []);
  }

  const attempts = emailRateLimit.get(key);
  // Remove attempts older than 1 minute
  const recentAttempts = attempts.filter((time) => now - time < minute);

  // Check rate limit (max 3 emails per minute per email/type)
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
