// scripts/createSuperAdmin.js
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
require('dotenv').config();

const createSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Check if super admin already exists
    const existingAdmin = await Admin.findOne({ role: 'super_admin' });
    if (existingAdmin) {
      console.log('Super admin already exists:', existingAdmin.username);
      return;
    }

    // Create super admin
    const superAdmin = new Admin({
      username: 'LionBidi',
      email: 'lionbidicompany@gmail.com',
      password: 'Samrat007', // Change this to a secure password
      role: 'super_admin',
      permissions: ['payment_verification', 'order_management', 'user_management', 'analytics']
    });

    await superAdmin.save();
    console.log('✅ Super admin created successfully!');
    console.log('Username:', superAdmin.username);
    console.log('Email:', superAdmin.email);
    console.log('Role:', superAdmin.role);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    process.exit(1);
  }
};

createSuperAdmin();
