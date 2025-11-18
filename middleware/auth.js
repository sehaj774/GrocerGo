const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to silently set the user on the request object if they are logged in.
// This does NOT block requests. It just identifies the user.
exports.setUser = async (req, res, next) => {
    let token;
    if (req.cookies.token) {
        token = req.cookies.token;
    }

    // Don't do anything if there's no token
    if (!token) {
        return next();
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Attach user to the request object, making it available in all subsequent middleware/routes
        req.user = await User.findById(decoded.user.id).select('-password');
    } catch (err) {
        // If token is invalid, just ignore it.
        console.log('Invalid token found.');
    }
    
    next();
};

// Middleware to protect routes. This CHECKS if a user is set.
// If not, it blocks the request.
exports.protect = (req, res, next) => {
    if (req.user) {
        return next(); // User is logged in, proceed.
    }
    // No user found, redirect to login.
    res.status(401).redirect('/auth/login');
};

// Middleware to grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).render('error', { 
                error: {
                    status: 403,
                    message: 'You are not authorized to access this page.'
                }
            });
        }
        next();
    };
};

// This sends a JSON error instead of redirecting.
exports.protectApi = (req, res, next) => {
    if (req.user) {
        return next(); // User is logged in, proceed.
    }
    // No user found, send a 401 Unauthorized JSON response.
    res.status(401).json({ success: false, message: 'Please log in to perform this action.' });
};

// Middleware to grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            // Updated error to be more descriptive for easier debugging
            const err = new Error(`Forbidden: Your role ('${req.user ? req.user.role : 'Guest'}') is not authorized. Access requires one of the following roles: ${roles.join(', ')}.`);
            err.status = 403;
            return next(err);
        }
        next();
    };
};

