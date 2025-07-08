// middleware/cloudinaryUploader.js
const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../utils/cloudinary'); // your current config

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'store_logos',
    allowed_formats: ['jpg', 'jpeg', 'png']
  }
});

const upload = multer({ storage });

module.exports = upload;
