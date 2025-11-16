const viewLocals = (req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.userPincode = req.cookies.pincode || '110001'; 
    
    // If a user is logged in, set the cart count from their data.
    if (req.user) {
        res.locals.cartCount = req.user.cart.length;
    } else {
        // Otherwise, the cart count is 0.
        res.locals.cartCount = 0;
    }

    next();
};

module.exports = viewLocals;