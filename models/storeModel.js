const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  storeName: {
    type: String,
    required: true
  },

  slug: {
    type: String,
    unique: true,
    index: true
  },

  sellerName: String,
  sellerNumber: String,
  storeDescription: String,

  storeLogo: {
    type: String,
    required: true
  },

  publicId: {
    type: String
  }

}, { timestamps: true });

/**
 * Auto-generate slug BEFORE saving (only once)
 */
storeSchema.pre("save", function (next) {
  if (this.slug) return next(); // don't regenerate on updates

  const baseSlug = this.storeName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  this.slug = `${baseSlug}-${Date.now()}`;
  next();
});

module.exports = mongoose.model('Store', storeSchema);
