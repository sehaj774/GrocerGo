const mongoose = require('mongoose');

// Add this new schema for a single address
const addressSchema = new mongoose.Schema({
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true, length: 6 },
    phone: { type: String, required: true, length: 10 }
});

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { 
        type: String, 
        enum: ['CUSTOMER', 'PRODUCT_MANAGER', 'ADMIN'], 
        default: 'CUSTOMER' 
    },
    cart: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product'
            },
            quantity: {
                type: Number,
                required: true,
                min: 1,
                default: 1
            }
        }
    ],
    // Add this new field to store an array of addresses
    addresses: [addressSchema]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);