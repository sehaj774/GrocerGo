const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    unit: { type: String, required: true },
    image: { type: String, required: true },
    verified: { type: Boolean, default: false },
    stock: { type: Number, default: 100 }
}, { timestamps: true });

// index to the name field for faster searching
productSchema.index({ name: 'text', category: 1 });

module.exports = mongoose.model('Product', productSchema);