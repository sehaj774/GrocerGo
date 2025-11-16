const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // We store a copy of the product details at the time of purchase
    // This ensures that if a product's price changes later, the order history remains accurate.
    products: [{
        product: { type: Object, required: true },
        quantity: { type: Number, required: true }
    }],
    subtotal: {
        type: Number,
        required: true
    },
    deliveryFee: {
        type: Number,
        required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },
    shippingAddress: {
        type: String,
        required: true,
        default: 'Not Provided' // We'll add a form for this in a later phase
    },
    status: {
        type: String,
        enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Processing'
    },
    orderDate: {
        type: Date,
        default: Date.now
    },

    driverName: { 
        type: String,
        default: null // Will be null until assigned
    },
    tipAmount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);

