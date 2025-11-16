const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /api/user/addresses - Get all addresses for the logged-in user
router.get('/addresses', async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({ success: true, addresses: user.addresses });
    } catch (err) {
        next(err);
    }
});

// POST /api/user/addresses - Add a new address for the logged-in user
router.post('/addresses', async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        const newAddress = req.body; // { street, city, state, pincode, phone }
        user.addresses.push(newAddress);
        await user.save();
        
        // Return the newly created address, which now has an _id
        const savedAddress = user.addresses[user.addresses.length - 1];
        res.status(201).json({ success: true, address: savedAddress });
    } catch (err) {
        next(err);
    }
});

module.exports = router;