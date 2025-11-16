const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    logo: { type: String, required: true },
    verified: { type: Boolean, default: false },
    category: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Brand', brandSchema);
