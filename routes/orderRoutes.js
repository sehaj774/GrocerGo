const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protectApi, protect } = require('../middleware/auth');
const { redisClient } = require('../config/redisClient'); // <-- ADD THIS LINE

// Note: Protection is applied individually to the routes below.

// --- PAGE RENDERING ROUTES ---

// GET /orders - Display user's order history page. This requires a user to be logged in.
router.get('/', protect, async (req, res, next) => {
    try {
        const orders = await Order.find({ user: req.user.id }).sort({ orderDate: -1 }).lean();
        res.render('orders', { orders });
    } catch (err) {
        next(err);
    }
});

// GET /orders/:id - Display the details page for a single order.
router.get('/:id', protect, async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id).lean();

        // Security check: Ensure the order belongs to the logged-in user before showing it.
        if (!order || order.user.toString() !== req.user.id.toString()) {
            const err = new Error('Order not found or you are not authorized to view it.');
            err.status = 404;
            return next(err);
        }

        res.render('order-details', { order });
    } catch (err) {
        next(err);
    }
});


// --- API ROUTE FOR CHECKOUT ---

// POST /checkout - The checkout logic. This will be mounted at /api/orders/checkout
router.post('/checkout', protectApi, async (req, res, next) => {
    try {
        const { addressId } = req.body;
        if (!addressId) {
            return res.status(400).json({ success: false, message: 'Shipping address is required.' });
        }

        const user = await User.findById(req.user.id).populate('cart.product');

        if (!user || user.cart.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty.' });
        }
        
        const shippingAddressObject = user.addresses.id(addressId);
        if (!shippingAddressObject) {
            return res.status(404).json({ success: false, message: 'Address not found.' });
        }
        const shippingAddress = `${shippingAddressObject.street}, ${shippingAddressObject.city}, ${shippingAddressObject.state} - ${shippingAddressObject.pincode}`;

        const subtotal = user.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
        const deliveryFee = subtotal >= 199 ? 0 : 50;
        const totalAmount = subtotal + deliveryFee;

        for (const item of user.cart) {
            if (item.product.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock for ${item.product.name}. Only ${item.product.stock} left.`
                });
            }
        }
        
        const orderProducts = user.cart.map(item => ({
            product: {
                _id: item.product._id, name: item.product.name,
                price: item.product.price, image: item.product.image
            },
            quantity: item.quantity
        }));

        const newOrder = await Order.create({
            user: req.user.id,
            products: orderProducts,
            subtotal,
            deliveryFee,
            totalAmount,
            shippingAddress
        });

        const io = req.app.get('socketio');
        io.emit('newOrder', {
            orderId: newOrder._id,
            totalAmount: newOrder.totalAmount,
            user: req.user.name
        });

        for (const item of user.cart) {
            await Product.updateOne({ _id: item.product._id }, { $inc: { stock: -item.quantity } });
        }

        user.cart = [];
        await user.save();

        // --- START: Update Top Products Leaderboard ---
        try {
            const leaderboardKey = 'top_products';
            for (const item of orderProducts) {
                // Increment the score for each product ID by its quantity
                await redisClient.zIncrBy(leaderboardKey, item.quantity, item.product._id.toString());
            }
        } catch (redisErr) {
            console.error('Redis Leaderboard Error:', redisErr);
            // Don't fail the order, just log the error
        }
        // --- END: Update Top Products Leaderboard ---

        res.status(201).json({ success: true, message: 'Order placed!', orderId: newOrder._id });

    } catch (err) {
        next(err);
    }
});

// POST /api/orders/:id/tip - Add a tip to an order
router.post('/:id/tip', protectApi, async (req, res, next) => {
    try {
        const { tipAmount } = req.body;
        const orderId = req.params.id;
        const userId = req.user.id;

        // Ensure tip is a positive number
        const tip = parseFloat(tipAmount);
        if (isNaN(tip) || tip < 0) {
            return res.status(400).json({ success: false, message: 'Invalid tip amount.' });
        }

        // Find the order and ensure it belongs to the user
        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }
        
        // Update tip amount (assuming only one tip can be added)
        order.tipAmount = tip;
        await order.save();
        
        // Optionally, recalculate total if tip affects it (depends on payment flow)
        // For now, just confirming tip is saved.

        res.json({ success: true, message: 'Tip added successfully!', tipAmount: order.tipAmount });

    } catch (err) {
        next(err);
    }
});

module.exports = router;