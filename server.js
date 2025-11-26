const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');
const https = require('https'); 
const http = require('http'); 
const fs = require('fs'); 
const { Server } = require("socket.io");
const morgan = require('morgan');

// 1. DOTENV CONFIG
dotenv.config({ path: './.env' });

// --- Connect to Databases ---
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

// --- SSL Options ---
let sslOptions = {};
try {
    sslOptions = {
        key: fs.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'))
    };
} catch (err) {
    console.log("Warning: SSL keys not found. HTTPS might fail locally.");
}

// --- Create Server ---
let server;
if (process.env.NODE_ENV === 'production' || !sslOptions.key) {
    server = http.createServer(app);
} else {
    server = https.createServer(sslOptions, app);
}

// --- Socket.io Setup ---
const io = new Server(server);
app.set('socketio', io);

// --- Standard Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public'))); 
app.use(morgan('dev'));



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

// --- ROUTE MOUNTING ---
app.use('/api/cart', protectApi, cartRoutes);
app.use('/api/orders', orderRoutes); 
app.use('/admin/delivery', protect, authorize('ADMIN'), deliveryRoutes);
app.use('/admin', protect, adminRoutes);
app.use('/orders', protect, orderRoutes);
app.use('/api/user', protectApi, userRoutes);
app.use('/auth', authRoutes);
app.use('/', pageRoutes);

// --- Error Handling ---
app.use((err, req, res, next) => {
    console.error('ERROR:', err.stack);
    const status = err.status || 500;
    // Check if headers already sent to avoid crashing on double response
    if (res.headersSent) {
        return next(err);
    }
    res.status(status).render('error', {
        error: {
            status,
            message: err.message || 'Something went wrong on our end.'
        }
    });
});

// --- Start the Server --- 
const PORT = process.env.PORT || 3000;

const listener = server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port https://localhost:${PORT}`);
});

module.exports = { app, server: listener };
