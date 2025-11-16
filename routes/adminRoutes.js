const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Brand = require('../models/Brand');
const Order = require('../models/Order');
const { authorize } = require('../middleware/auth');
const { redisClient } = require('../config/redisClient');

// NOTE: The main `protect` middleware is applied in server.js before this router is used.

// --- PAGE ROUTES ---

// GET /admin/dashboard - Main admin dashboard view
router.get('/dashboard', authorize('PRODUCT_MANAGER', 'ADMIN'), (req, res) => {
    res.render('admin/dashboard');
});

// GET /admin/brands - Brand management view
router.get('/brands', authorize('ADMIN'), async (req, res, next) => {
    try {
        const brands = await Brand.find().lean();
        res.render('admin/brands', { brands });
    } catch (err) {
        next(err);
    }
});

// POST /admin/brands/:id/verify - Toggle brand verification status
router.post('/brands/:id/verify', authorize('ADMIN'), async (req, res, next) => {
    try {
        const brand = await Brand.findById(req.params.id);
        if (brand) {
            brand.verified = !brand.verified; // Flip the boolean value
            await brand.save();
        }
        res.redirect('/admin/brands');
    } catch (err) {
        next(err);
    }
});

// GET /admin/brands/new - Display form to create a new brand
router.get('/brands/new', authorize('ADMIN'), (req, res) => {
    res.render('admin/brand-form');
});

// POST /admin/brands/new - Handle new brand creation
router.post('/brands/new', authorize('ADMIN'), async (req, res, next) => {
    try {
        const { name, logo, category } = req.body;
        await Brand.create({ name, logo, category });
        res.redirect('/admin/brands');
    } catch (err) {
        // This will catch errors, like if the brand name is not unique
        next(err);
    }
});

// GET /admin/products - Product management view
router.get('/products', authorize('PRODUCT_MANAGER', 'ADMIN'), async (req, res, next) => {
    try {
        const products = await Product.find().populate('brand').lean();
        res.render('admin/products', { products });
    } catch (err) {
        next(err);
    }
});

// GET /admin/products/new - Display form to create a new product
router.get('/products/new', authorize('PRODUCT_MANAGER', 'ADMIN'), async (req, res, next) => {
    try {
        const brands = await Brand.find().sort({ name: 1 }).lean();
        res.render('admin/product-form', { 
            title: 'Add New Product',
            action: '/admin/products/new',
            product: {},
            brands 
        });
    } catch (err) {
        next(err);
    }
});

// POST /admin/products/new - Handle new product creation
router.post('/products/new', authorize('PRODUCT_MANAGER', 'ADMIN'), async (req, res, next) => {
    try {
        await Product.create(req.body);
        res.redirect('/admin/products');
    } catch (err) {
        next(err);
    }
});

// GET /admin/products/:id/edit - Display form to edit a product
router.get('/products/:id/edit', authorize('PRODUCT_MANAGER', 'ADMIN'), async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id).lean();
        const brands = await Brand.find().sort({ name: 1 }).lean();
        if (!product) {
            return res.redirect('/admin/products');
        }
        res.render('admin/product-form', {
            title: 'Edit Product',
            action: `/admin/products/${req.params.id}/edit`,
            product,
            brands
        });
    } catch (err) {
        next(err);
    }
});

// POST /admin/products/:id/edit - Handle product update
router.post('/products/:id/edit', authorize('PRODUCT_MANAGER', 'ADMIN'), async (req, res, next) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.redirect('/admin/products');
    } catch (err) {
        next(err);
    }
});

// POST /admin/products/:id/delete - Handle product deletion
router.post('/products/:id/delete', authorize('PRODUCT_MANAGER', 'ADMIN'), async (req, res, next) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.redirect('/admin/products');
    } catch (err) {
        next(err);
    }
});

// POST /admin/products/:id/verify - Toggle verification (ADMINS ONLY)
router.post('/products/:id/verify', authorize('ADMIN'), async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            product.verified = !product.verified;
            await product.save();
        }
        res.redirect('/admin/products');
    } catch (err) {
        next(err);
    }
});

// --- API ROUTES ---

// GET /admin/api/stats - API endpoint for dashboard analytics
router.get('/api/stats', authorize('ADMIN'), async (req, res, next) => {
    try {
        const totalRevenueResult = await Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        const salesByDay = await Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { 
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    totalSales: { $sum: '$totalAmount' }
                }
            },
            { $sort: { _id: 1 } },
            { $limit: 30 }
        ]);

        res.json({
            totalRevenue: totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0,
            salesByDay
        });
    } catch (err) {
        next(err);
    }
});

// --- START: New Leaderboard API Route --- // <-- ADDED BLOCK
// GET /admin/api/leaderboard - Get top 5 selling products
router.get('/api/leaderboard', authorize('ADMIN', 'PRODUCT_MANAGER'), async (req, res, next) => {
    try {
        const leaderboardKey = 'top_products';

        // Get top 5 products WITH their scores, in reverse order (highest score first)
        const topProductsWithScores = await redisClient.zRangeWithScores(leaderboardKey, 0, 4, { REV: true });
        
        if (!topProductsWithScores || topProductsWithScores.length === 0) {
            return res.json({ success: true, leaderboard: [] });
        }

        // Get just the product IDs from the Redis result
        const productIds = topProductsWithScores.map(item => item.value);

        // Fetch the product details from MongoDB
        const products = await Product.find({
            '_id': { $in: productIds }
        }).lean();

        // Create a quick lookup map for product details
        const productMap = products.reduce((map, product) => {
            map[product._id.toString()] = product;
            return map;
        }, {});

        // Combine Redis scores with MongoDB details
        const leaderboard = topProductsWithScores.map(item => ({
            ...productMap[item.value], // Product details (name, image, etc.)
            score: item.score         // The total quantity sold (from Redis)
        })).filter(item => item.name); // Filter out any products that might be missing

        res.json({ success: true, leaderboard });

    } catch (err) {
        next(err);
    }
});
// --- END: New Leaderboard API Route ---

// GET /admin/orders - Display all orders
router.get('/orders', authorize('ADMIN', 'PRODUCT_MANAGER'), async (req, res, next) => {
    try {
        const orders = await Order.find().populate('user', 'name').sort({ orderDate: -1 }).lean();
        res.render('admin/orders', { orders });
    } catch (err) {
        next(err);
    }
});

// GET /admin/orders/:id - Display details for a single order
router.get('/orders/:id', authorize('ADMIN', 'PRODUCT_MANAGER'), async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id).populate('user', 'name email').lean();
        if (!order) {
            return res.redirect('/admin/orders');
        }
        res.render('admin/order-details', { order });
    } catch (err) {
        next(err);
    }
});

// POST /admin/orders/:id/status - Update an order's status and assign driver
router.post('/orders/:id/status', authorize('ADMIN', 'PRODUCT_MANAGER'), async (req, res, next) => {
    try {
        const { status, driverName } = req.body; // Get potential driver name
        const orderId = req.params.id;

        const updateData = { status };
        // Only add driverName to the update if it's provided (when marking as shipped)
        if (driverName) {
            updateData.driverName = driverName;
        }

        const updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, { new: true });

        if (updatedOrder) {
            const io = req.app.get('socketio');
            // Include driver name in the update event if available
            io.emit('orderStatusUpdate', { 
                orderId: orderId, 
                newStatus: updatedOrder.status,
                driverName: updatedOrder.driverName // Send driver name if it exists
            });
        }

        res.redirect(`/admin/orders/${orderId}`);
    } catch (err) {
        next(err);
    }
});



module.exports = router;