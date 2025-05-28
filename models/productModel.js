const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  productName: String,
  price: Number,
  image: String
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
