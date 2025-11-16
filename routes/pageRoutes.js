const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { redisClient } = require('../config/redisClient');
const { protect } = require('../middleware/auth');


// Import Mongoose Models
const Product = require('../models/Product');
const Brand = require('../models/Brand');
const User = require('../models/User'); 
// const Category = require('../models/Category'); // We'll add this later if needed

// Helper function for reading the static categories JSON
const readCategories = async () => {
  const filePath = path.join(__dirname, '..', 'data', 'categories.json');
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
};


// Homepage
router.get('/', async (req, res, next) => {
  try {
    const cacheKey = 'homepage:data';

    // 1. Check Redis for cached data
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log('CACHE HIT: Serving data from Redis.');
      const { products, categories, brands, vegetables } = JSON.parse(cachedData);
      return res.render('index', { products, vegetables, categories, brands });
    }

    // 2. If no cache, fetch from the database
    console.log('CACHE MISS: Fetching data from MongoDB.');
    const [products, categories, brands] = await Promise.all([
      Product.find({ verified: true }).populate('brand').limit(12).lean(),
      readCategories(),
      Brand.find({ verified: true }).limit(6).lean()
    ]);
    const vegetables = products.filter(p => p.category === 'vegetables').slice(0, 6);
    const responseData = { products, vegetables, categories, brands };

    // 3. Store the new data in Redis with a 1-hour expiration
    await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 3600 });
    
    res.render('index', responseData);
  } catch (err) {
    next(err);
  }
});

// All Products Page
router.get('/products', async (req, res, next) => {
    try {
        const products = await Product.find({}).populate('brand').lean();
        res.render('products', { products });
    } catch (err) {
        next(err);
    }
});

// Category Pages
router.get('/category/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;

    const [products, categories] = await Promise.all([
        Product.find({ category: slug }).populate('brand').lean(),
        readCategories()
    ]);
    
    const category = categories.find(c => c.slug === slug);
    if (!category) {
      const err = new Error('Category not found.');
      err.status = 404;
      return next(err);
    }
    res.render('category', { products, category });
  } catch (err) {
    next(err);
  }
});

// Brands Page
router.get('/brands', async (req, res, next) => {
  try {
    const brands = await Brand.find({}).lean();
    res.render('brands', { brands });
  } catch (err) {
    next(err);
  }
});

// Search Page
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    const searchQuery = typeof q === 'string' ? q.trim() : '';
    let products = [];

    if (searchQuery) {
      // Use the text index we created in the Product model for efficient search
      products = await Product.find(
          { $text: { $search: searchQuery } },
          { score: { $meta: "textScore" } }
      ).sort({ score: { $meta: "textScore" } }).populate('brand').lean();
    } else {
      // If no search query, show all products
      products = await Product.find({}).populate('brand').lean();
    }
    
    res.render('search', { products, searchQuery });
  } catch (err) {
    next(err);
  }
});

// GET /checkout - Renders the checkout page
router.get('/checkout', protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).populate('cart.product').lean();
        if (!user || user.cart.length === 0) {
            return res.redirect('/'); // Redirect home if cart is empty
        }

        const subtotal = user.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
        const deliveryFee = subtotal >= 199 ? 0 : 50;
        const total = subtotal + deliveryFee;
        
        res.render('checkout', { 
            cart: user.cart,
            addresses: user.addresses,
            subtotal,
            deliveryFee,
            total 
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;