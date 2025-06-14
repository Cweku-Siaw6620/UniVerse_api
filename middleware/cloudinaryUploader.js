/*
const multer = require('multer');

const storage = multer.diskStorage({
  filename: function (req,file,cb) {
    cb(null, file.originalname)
  }
});

const upload = multer({storage: storage});

module.exports = upload;

*/
// multer.js
/*const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

module.exports = upload;
*/
// middleware/cloudinaryUploader.js
const multer = require('multer');
const path = require('path')
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
//onst upload = multer({ storage : multer.memoryStorage() });

module.exports = upload;
