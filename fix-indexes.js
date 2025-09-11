// fix-indexes.js
const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexes() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // List current indexes
    console.log('\n📋 Current indexes before fix:');
    const currentIndexes = await usersCollection.indexes();
    currentIndexes.forEach(index => {
      if (index.name.includes('phone') || index.name.includes('googleId')) {
        console.log(`- ${index.name}:`, index.key, index.sparse ? '(sparse)' : '(not sparse)');
      }
    });
    
    // Drop problematic indexes
    try {
      await usersCollection.dropIndex('phone_1');
      console.log('✅ Dropped old phone_1 index');
    } catch (e) {
      console.log('❌ phone_1 index not found or already dropped');
    }
    
    try {
      await usersCollection.dropIndex('googleId_1');
      console.log('✅ Dropped old googleId_1 index');
    } catch (e) {
      console.log('❌ googleId_1 index not found');
    }
    
    // Create new SPARSE unique indexes
    await usersCollection.createIndex(
      { phone: 1 }, 
      { unique: true, sparse: true, name: 'phone_sparse_unique' }
    );
    console.log('✅ Created phone sparse unique index');
    
    await usersCollection.createIndex(
      { googleId: 1 }, 
      { unique: true, sparse: true, name: 'googleId_sparse_unique' }
    );
    console.log('✅ Created googleId sparse unique index');
    
    // Verify new indexes
    console.log('\n📋 New indexes after fix:');
    const newIndexes = await usersCollection.indexes();
    newIndexes.forEach(index => {
      if (index.name.includes('phone') || index.name.includes('googleId')) {
        console.log(`- ${index.name}:`, index.key, index.sparse ? '(sparse)' : '(not sparse)');
      }
    });
    
    console.log('\n🎉 Index fix completed successfully!');
    console.log('You can now test Google OAuth authentication.');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error fixing indexes:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the fix
fixIndexes();
