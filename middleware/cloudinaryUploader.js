// middleware/cloudinaryUploader.js
const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../utils/cloudinary'); // your current config

// Store Logo Uploader
const storeStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'store_logos',
    allowed_formats: ['jpg', 'jpeg', 'png'],
  }
});

const storeUpload = multer({ storage: storeStorage });


// Product Image Uploader
const productStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'product_images',
    allowed_formats: ['jpg', 'jpeg', 'png'],
  }
});

const productUpload = multer({ storage: productStorage });

module.exports = {
  storeUpload,
  productUpload
};
