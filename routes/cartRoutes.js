const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product'); // Ensure Product is required for population

// GET / - Handles requests to /api/cart
router.get('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate({
        path: 'cart.product',
        model: 'Product'
    }).lean();
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const total = user.cart.reduce((sum, item) => {
      if (item.product) {
        return sum + (item.product.price * item.quantity);
      }
      return sum;
    }, 0);

    res.json({
      success: true,
      items: user.cart,
      total: total.toFixed(2),
      count: user.cart.length
    });
  } catch (err) {
    next(err);
  }
});

// POST /add - Handles requests to /api/cart/add
router.post('/add', async (req, res, next) => {
    try {
        const { productId, quantity } = req.body;
        const user = await User.findById(req.user.id);

        const cartItem = user.cart.find(item => item.product.toString() === productId);

        if (cartItem) {
            cartItem.quantity += parseInt(quantity);
        } else {
            user.cart.push({ product: productId, quantity: parseInt(quantity) });
        }

        await user.save();
        res.json({ success: true, cartCount: user.cart.length });

    } catch (err) {
        next(err);
    }
});

// PUT /:itemId - Handles requests to /api/cart/:itemId
router.put('/:itemId', async (req, res, next) => {
    try {
        const { itemId } = req.params;
        const { quantity } = req.body;
        
        const user = await User.findById(req.user.id);
        const item = user.cart.id(itemId); 

        if (item) {
            if (parseInt(quantity) > 0) {
                item.quantity = parseInt(quantity);
            } else {
                user.cart.pull(itemId);
            }
            await user.save();
            res.json({ success: true, cartCount: user.cart.length });
        } else {
            res.status(404).json({ success: false, message: 'Item not found in cart' });
        }
    } catch (err) {
        next(err);
    }
});

// DELETE /:itemId - Handles requests to /api/cart/:itemId
router.delete('/:itemId', async (req, res, next) => {
    try {
        const { itemId } = req.params;
        const user = await User.findById(req.user.id);

        user.cart.pull(itemId);
        
        await user.save();
        res.json({ success: true, cartCount: user.cart.length });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

