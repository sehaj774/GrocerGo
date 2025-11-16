const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');
const https = require('https'); 
const fs = require('fs'); 
const { Server } = require("socket.io");
const morgan = require('morgan');

// 1. DOTENV CONFIG MUST BE AT THE TOP
// This loads variables from .env so all other files can access them
dotenv.config({ path: './.env' });

// --- Connect to Databases (AFTER dotenv is loaded) ---
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redisClient');
connectDB();
connectRedis();

// --- Route Files ---
const authRoutes = require('./routes/authRoutes');
const pageRoutes = require('./routes/pageRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const userRoutes = require('./routes/userRoutes');


// --- Middleware ---
const { setUser, protect, authorize, protectApi } = require('./middleware/auth');
const viewLocals = require('./middleware/viewLocals');

const app = express();

// --- Read SSL Certificate Files ---  
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'))
};

// --- Create HTTPS Server and Attach Socket.IO --- 
const httpsServer = https.createServer(sslOptions, app);
const io = new Server(httpsServer);

// Make the `io` object accessible to all your routes
app.set('socketio', io);

// --- MIDDLEWARE SETUP ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Static File Caching ---
const staticOptions = {
    maxAge: '1d', // Cache static assets for 1 day
    etag: true      // Enable ETag (as per your notes)
};
app.use(express.static(path.join(__dirname, 'public'), staticOptions)); 

// --- Request Logger ---
app.use(morgan('dev'));

// This middleware runs on EVERY request to set up user if a token exists
app.use(setUser);
app.use(viewLocals);

// --- API ENDPOINT FOR PINCODE ---
app.post('/api/pincode', (req, res) => {
    const { pincode } = req.body;
    if (pincode && /^\d{6}$/.test(pincode)) {
        res.cookie('pincode', pincode, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
        return res.json({ success: true, message: 'Pincode updated.' });
    }
    res.status(400).json({ success: false, message: 'Invalid pincode.' });
});

// --- ROUTE MOUNTING (Correct Order is Crucial) ---

// API routes first
app.use('/api/cart', protectApi, cartRoutes);
app.use('/api/orders', orderRoutes); // `protectApi` is already inside the checkout route

// Admin page routes should be grouped together
app.use('/admin/delivery', protect, authorize('ADMIN'), deliveryRoutes);
app.use('/admin', protect, adminRoutes);

// User-specific page routes
app.use('/orders', protect, orderRoutes);

app.use('/api/user', protectApi, userRoutes);

// General public routes last
app.use('/auth', authRoutes);
app.use('/', pageRoutes); // This catch-all must be near the end

// --- Centralized Error Handling ---
app.use((err, req, res, next) => {
    console.error('ERROR:', err.stack);
    const status = err.status || 500;
    res.status(status).render('error', {
        error: {
            status,
            message: err.message || 'Something went wrong on our end.'
        }
    });
});

// --- Start the Server --- 
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3001; 

const listener = httpsServer.listen(HTTPS_PORT, () => {
    console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on https://localhost:${HTTPS_PORT}`);
});

// Export for testing purposes
module.exports = { app, server: listener };