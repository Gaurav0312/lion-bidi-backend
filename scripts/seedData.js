// scripts/seedData.js - Sample data seeder
const mongoose = require('mongoose');
const { Category } = require('../models/Category');
const Product = require('../models/Product');
require('dotenv').config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Category.deleteMany({});
    await Product.deleteMany({});

    // Create categories
    const categories = [
      {
        name: 'Cigarette',
        slug: 'cigarette',
        description: 'Premium cigarettes from international and domestic brands',
        subcategories: [
          { name: 'International Brands', slug: 'international-brands' },
          { name: 'Domestic Brands', slug: 'domestic-brands' },
          { name: 'Slim/Superslims', slug: 'slim-superslims' }
        ]
      },
      {
        name: 'Tobacco',
        slug: 'tobacco',
        description: 'High-quality rolling tobacco and pipe tobacco',
        subcategories: [
          { name: 'Rolling Tobacco', slug: 'rolling-tobacco' },
          { name: 'Pipe Tobacco', slug: 'pipe-tobacco' }
        ]
      },
      {
        name: 'Rolling Paper & Accessories',
        slug: 'rolling-paper-accessories',
        description: 'Rolling papers, filters, and smoking accessories',
        subcategories: [
          { name: 'Rolling Papers', slug: 'rolling-papers' },
          { name: 'Filters & Tips', slug: 'filters-tips' },
          { name: 'Accessories', slug: 'accessories' }
        ]
      },
      {
        name: 'BEEDI',
        slug: 'beedi',
        description: 'Traditional Indian beedis',
        subcategories: [
          { name: 'Regular Beedi', slug: 'regular-beedi' },
          { name: 'Flavored Beedi', slug: 'flavored-beedi' }
        ]
      }
    ];

    const createdCategories = await Category.insertMany(categories);
    console.log('Categories created:', createdCategories.length);

    // Create sample products
    const products = [
      {
        name: 'Camel Yellow',
        description: 'Premium international cigarette brand with smooth taste',
        price: 250,
        originalPrice: 350,
        category: createdCategories[0]._id,
        subcategory: 'International Brands',
        images: ['https://via.placeholder.com/300x300?text=Camel+Yellow'],
        brand: 'Camel',
        stockQuantity: 50,
        featured: true,
        bestseller: true,
        tags: ['premium', 'international', 'smooth']
      },
      {
        name: 'Camel Blue',
        description: 'Lighter variant of the popular Camel brand',
        price: 225,
        originalPrice: 350,
        category: createdCategories[0]._id,
        subcategory: 'International Brands',
        images: ['https://via.placeholder.com/300x300?text=Camel+Blue'],
        brand: 'Camel',
        stockQuantity: 45,
        bestseller: true,
        tags: ['premium', 'international', 'light']
      },
      {
        name: 'Golden Virginia Bright Yellow 50g',
        description: 'Premium rolling tobacco with golden flavor',
        price: 1050,
        originalPrice: 1200,
        category: createdCategories[1]._id,
        subcategory: 'Rolling Tobacco',
        images: ['https://via.placeholder.com/300x300?text=Golden+Virginia'],
        brand: 'Golden Virginia',
        weight: '50g',
        stockQuantity: 30,
        tags: ['premium', 'rolling', 'golden']
      },
      {
        name: 'RAW Rolling Papers',
        description: 'Natural unbleached rolling papers',
        price: 199,
        originalPrice: 249,
        category: createdCategories[2]._id,
        subcategory: 'Rolling Papers',
        images: ['https://via.placeholder.com/300x300?text=RAW+Papers'],
        brand: 'RAW',
        stockQuantity: 100,
        tags: ['natural', 'unbleached', 'quality']
      }
    ];

    const createdProducts = await Product.insertMany(products);
    console.log('Products created:', createdProducts.length);

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedData();