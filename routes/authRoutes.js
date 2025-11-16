const express = require('express');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// --- Page Rendering Routes ---
router.get('/register', (req, res) => res.render('register', { errors: [], oldInput: {} }));
router.get('/login', (req, res) => res.render('login', { errors: [], oldInput: {} }));

// --- API Logic Routes ---

// @desc    Register a new user with validation
// @route   POST /auth/register
router.post('/register', 
    [
        check('name', 'Please enter a name').not().isEmpty(),
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Password must be 6 or more characters').isLength({ min: 6 }),
        check('email').custom(async (email) => {
            const user = await User.findOne({ email });
            if (user) {
                return Promise.reject('E-mail already in use');
            }
        })
    ], 
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('register', { 
                errors: errors.array(),
                oldInput: { name: req.body.name, email: req.body.email }
            });
        }

        try {
            const { name, email, password } = req.body;
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // By default, all new sign-ups are 'CUSTOMER'
            const user = new User({ name, email, password: hashedPassword });
            await user.save();
            
            res.redirect('/auth/login');
        } catch (err) {
            console.error(err.message);
            res.status(500).render('register', { 
                errors: [{ msg: 'Server error. Please try again.' }],
                oldInput: { name: req.body.name, email: req.body.email }
            });
        }
    }
);

// @desc    Login a user and get JWT
// @route   POST /auth/login
router.post('/login',
    [
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Password is required').exists()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('login', {
                errors: errors.array(),
                oldInput: { email: req.body.email }
            });
        }
        
        try {
            const { email, password } = req.body;
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(400).render('login', { errors: [{ msg: 'Invalid credentials' }], oldInput: { email } });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).render('login', { errors: [{ msg: 'Invalid credentials' }], oldInput: { email } });
            }

            const payload = { user: { id: user.id, role: user.role } };

            jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' }, (err, token) => {
                if (err) throw err;
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: 30 * 24 * 60 * 60 * 1000
                });
                // Redirect admin to dashboard, customer to homepage
                if (user.role === 'ADMIN' || user.role === 'PRODUCT_MANAGER') {
                    res.redirect('/admin/dashboard'); 
                } else {
                    res.redirect('/');
                }
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).render('login', { errors: [{ msg: 'Server error' }], oldInput: { email: req.body.email }});
        }
    }
);

// @desc    Logout user
// @route   GET /auth/logout
router.get('/logout', (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
    });
    res.redirect('/auth/login');
});

module.exports = router;

