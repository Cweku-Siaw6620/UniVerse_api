const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  storeName : String,
  sellerName : String,
  sellerNumber : String,
  storeDescription : String,
  storeLogo : {type: String, required: true},
}, { timestamps: true });

module.exports = mongoose.model('Store', storeSchema);
