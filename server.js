const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();
const { storeUpload, productUpload } = require('./middleware/cloudinaryUploader');
const cloudinary = require('./utils/cloudinary');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Importing the models
const User = require('./models/userModel');
const Product = require('./models/productModel');
const Store = require('./models/storeModel');

// Google OAuth2 Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Allowed origins for CORS
const allowedOrigins = [
  'https://universeweb.netlify.app',
  "http://localhost:3000",
  "https://uni-verse-ebon.vercel.app",
  "http://127.0.0.1:5500",
  "http://localhost:5500"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin-allow-popups');
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none';");
  next();
});

app.use(express.json());
app.use(bodyParser.json());

// ============================================
// HELPER FUNCTIONS
// ============================================

// Check if ID card is expired
function isIdCardExpired(expiryDate) {
  if (!expiryDate) return true;
  const now = new Date();
  const expiry = new Date(expiryDate);
  return expiry < now;
}

// Configure multer for ID card uploads (memory storage, then upload to Cloudinary manually)
const idCardUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Route to verify Google token
app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload;

    let user = await User.findOne({ googleId: sub });

    if (!user) {
      user = await User.create({
        googleId: sub,
        email,
        name,
        picture,
        affiliation: 'external',
        profileCompleted: false
      });
    }

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      picture: user.picture,
      affiliation: user.affiliation,
      university: user.university,
      isVerified: user.isVerified,
      profileCompleted: user.profileCompleted
    });

  } catch (error) {
    console.error("Token verification error:", error.message);
    res.status(401).json({ message: "Invalid Google token" });
  }
});

// ============================================
// PROFILE COMPLETION ROUTE (for external affiliates)
// ============================================

app.put('/api/auth/google/user/completeProfile', async (req, res) => {
  const { userId, affiliation, university } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.affiliation = affiliation;
    user.profileCompleted = true;
    
    if (university) {
      user.university = university;
    }

    await user.save();
    
    res.status(200).json({ 
      message: "Profile saved successfully!", 
      user: {
        id: user._id,
        name: user.name,
        affiliation: user.affiliation,
        isVerified: user.isVerified,
        profileCompleted: user.profileCompleted
      }
    });

  } catch (error) {
    console.error("CompleteProfile Error:", error);
    res.status(500).json({ message: "Server error", details: error.message });
  }
});

// ============================================
// ID CARD VERIFICATION ROUTES
// ============================================

// Endpoint 1: Submit ID card for verification
app.post('/api/verification/submit-id-card', 
  idCardUpload.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage', maxCount: 1 }
  ]), 
  async (req, res) => {
    try {
      const { userId, university, expiryDate } = req.body;
      
      // Validation
      if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID is required' });
      }
      
      if (!req.files || !req.files.frontImage) {
        return res.status(400).json({ success: false, message: 'Front of ID card is required' });
      }
      
      if (!expiryDate) {
        return res.status(400).json({ success: false, message: 'ID card expiry date is required' });
      }
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      
      // Upload front image to Cloudinary
      const frontFile = req.files.frontImage[0];
      const frontBase64 = frontFile.buffer.toString('base64');
      const frontDataURI = `data:${frontFile.mimetype};base64,${frontBase64}`;
      
      const frontResult = await cloudinary.uploader.upload(frontDataURI, {
        folder: 'student_id_cards/front',
        use_filename: true
      });
      
      // Upload back image if provided
      let backResult = null;
      if (req.files.backImage) {
        const backFile = req.files.backImage[0];
        const backBase64 = backFile.buffer.toString('base64');
        const backDataURI = `data:${backFile.mimetype};base64,${backBase64}`;
        
        backResult = await cloudinary.uploader.upload(backDataURI, {
          folder: 'student_id_cards/back',
          use_filename: true
        });
      }
      
      // Delete old ID card images if they exist
      if (user.studentIdCard?.frontPublicId) {
        await cloudinary.uploader.destroy(user.studentIdCard.frontPublicId);
      }
      if (user.studentIdCard?.backPublicId) {
        await cloudinary.uploader.destroy(user.studentIdCard.backPublicId);
      }
      
      // Save ID card info to user
      user.affiliation = 'student_pending';
      user.university = university || user.university;
      user.studentIdCard = {
        frontImage: frontResult.secure_url,
        frontPublicId: frontResult.public_id,
        backImage: backResult ? backResult.secure_url : null,
        backPublicId: backResult ? backResult.public_id : null,
        expiryDate: new Date(expiryDate),
        submittedAt: new Date()
      };
      user.isVerified = false;
      user.profileCompleted = true;
      
      await user.save();
      
      res.json({ 
        success: true, 
        message: 'ID card submitted for review. You will be notified once verified.',
        status: 'pending'
      });
      
    } catch (error) {
      console.error('ID card submission error:', error);
      res.status(500).json({ success: false, message: 'Failed to submit ID card. Please try again.' });
    }
  }
);

// Endpoint 2: Admin approves a student ID card
app.post('/api/verification/admin/approve', async (req, res) => {
  try {
    const { userId } = req.body;
    
    // TODO: Add admin authentication check here
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (!user.studentIdCard || !user.studentIdCard.expiryDate) {
      return res.status(400).json({ success: false, message: 'No ID card found for this user.' });
    }
    
    if (isIdCardExpired(user.studentIdCard.expiryDate)) {
      return res.status(400).json({ success: false, message: 'ID card is expired. User cannot be verified.' });
    }
    
    user.affiliation = 'student_verified';
    user.isVerified = true;
    user.studentIdCard.verifiedAt = new Date();
    
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Student verified successfully!',
      user: {
        id: user._id,
        name: user.name,
        affiliation: user.affiliation,
        isVerified: user.isVerified
      }
    });
    
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve verification' });
  }
});

// Endpoint 3: Admin rejects a student ID card
app.post('/api/verification/admin/reject', async (req, res) => {
  try {
    const { userId, reason } = req.body;
    
    // TODO: Add admin authentication check here
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.affiliation = 'external';
    user.isVerified = false;
    user.studentIdCard.rejectedAt = new Date();
    user.studentIdCard.rejectionReason = reason || 'ID card could not be verified';
    
    await user.save();
    
    res.json({ success: true, message: 'Verification request rejected' });
    
  } catch (error) {
    console.error('Rejection error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject verification' });
  }
});

// Endpoint 4: Check verification status with expiry check
app.get('/api/verification/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    let isStillVerified = user.isVerified;
    let expiryStatus = null;
    
    if (user.affiliation === 'student_verified' && user.studentIdCard?.expiryDate) {
      const isExpired = isIdCardExpired(user.studentIdCard.expiryDate);
      
      if (isExpired) {
        isStillVerified = false;
        user.affiliation = 'external';
        user.isVerified = false;
        await user.save();
        expiryStatus = 'expired';
      } else {
        const now = new Date();
        const expiryDate = new Date(user.studentIdCard.expiryDate);
        const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
        expiryStatus = { daysLeft: daysUntilExpiry, expiresAt: expiryDate };
      }
    }
    
    let idCardStatus = 'not_submitted';
    if (user.studentIdCard?.verifiedAt) {
      idCardStatus = 'approved';
    } else if (user.studentIdCard?.rejectedAt) {
      idCardStatus = 'rejected';
    } else if (user.studentIdCard?.submittedAt) {
      idCardStatus = 'pending';
    }
    
    res.json({
      success: true,
      affiliation: user.affiliation,
      isVerified: isStillVerified,
      university: user.university,
      profileCompleted: user.profileCompleted,
      idCardSubmitted: !!user.studentIdCard?.submittedAt,
      idCardStatus: idCardStatus,
      expiryStatus: expiryStatus,
      rejectionReason: user.studentIdCard?.rejectionReason,
      idCardImages: {
        front: user.studentIdCard?.frontImage || null,
        back: user.studentIdCard?.backImage || null
      }
    });
    
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ success: false, message: 'Failed to check verification status' });
  }
});

// Endpoint 5: Get pending verifications for admin
app.get('/api/verification/admin/pending', async (req, res) => {
  try {
    const pendingUsers = await User.find({ 
      affiliation: 'student_pending',
      'studentIdCard.submittedAt': { $exists: true },
      'studentIdCard.verifiedAt': { $exists: false },
      'studentIdCard.rejectedAt': { $exists: false }
    }).select('name email university studentIdCard createdAt');
    
    res.json({
      success: true,
      count: pendingUsers.length,
      users: pendingUsers
    });
    
  } catch (error) {
    console.error('Fetch pending error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending verifications' });
  }
});

// Endpoint 6: Get all verified students (for admin)
app.get('/api/verification/admin/verified', async (req, res) => {
  try {
    const verifiedUsers = await User.find({ 
      affiliation: 'student_verified',
      isVerified: true
    }).select('name email university studentIdCard.expiryDate createdAt');
    
    res.json({
      success: true,
      count: verifiedUsers.length,
      users: verifiedUsers
    });
    
  } catch (error) {
    console.error('Fetch verified error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch verified students' });
  }
});

// ============================================
// USER ROUTES
// ============================================

app.get('/api/auth/google', async (req, res) => {
  try {
    const users = await User.find({});
    res.status(200).json(users);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/auth/google/oneUser/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Failed to fetch user details" });
  }
});

app.delete('/api/auth/google/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const store = await Store.findOne({ owner: id });
    if (store && store.publicId) {
      await cloudinary.uploader.destroy(store.publicId);
    }
    await Store.findOneAndDelete({ owner: id });
    
    const user = await User.findById(id);
    if (user?.studentIdCard?.frontPublicId) {
      await cloudinary.uploader.destroy(user.studentIdCard.frontPublicId);
    }
    if (user?.studentIdCard?.backPublicId) {
      await cloudinary.uploader.destroy(user.studentIdCard.backPublicId);
    }
    
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: `No user found with ID ${id}` });
    }
    
    res.status(200).json({ message: `User with ID ${id} has been deleted` });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// STORE ROUTES (Using your existing cloudinaryUploader)
// ============================================

app.post('/api/stores', storeUpload.single('storeLogo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const { userId, storeName, sellerName, storeDescription, sellerNumber, personalWebsite } = req.body;
  
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const existingStore = await Store.findOne({ owner: userId });
    if (existingStore) {
      return res.status(409).json({ message: "Store already exists for this user." });
    }

    const store = await Store.create({
      owner: userId,
      storeName,
      sellerName,
      sellerNumber,
      storeDescription,
      storeLogo: req.file.path,
      publicId: req.file.filename,
      personalWebsite
    });
    res.status(201).json(store);
  } catch (err) {
    console.error("Error saving store:", err);
    res.status(500).json({ message: "Failed to save store" });
  }
});

app.get('/api/stores/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const store = await Store.findOne({ owner: userId });
    res.status(200).json(store);
  } catch (err) {
    console.error("Error fetching Store:", err);
    res.status(500).json({ message: "Failed to fetch store" });
  }
});

app.get('/api/stores/storeID/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findById(id);
    if (!store) return res.status(404).json({ message: "Store not found" });
    res.status(200).json(store);
  } catch (error) {
    console.error("Error fetching store:", error);
    res.status(500).json({ message: "Failed to fetch store details" });
  }
});

app.get('/api/stores/slug/:slug', async (req, res) => {
  try {
    const store = await Store.findOne({ slug: req.params.slug });
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }
    res.json(store);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/stores/:id/exists', async (req, res) => {
  try {
    const userId = req.params.id;
    const store = await Store.findOne({ owner: userId });
    res.json({ hasStore: !!store });
  } catch (err) {
    console.error("Error fetching Store:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/stores', async (req, res) => {
  try {
    const stores = await Store.find({});
    for (let i = stores.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [stores[i], stores[j]] = [stores[j], stores[i]];
    }
    res.status(200).json(stores);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/stores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findById(id);
    if (!store) {
      return res.status(404).json({ message: `No store found with ID ${id}` });
    }
    if (store.publicId) {
      await cloudinary.uploader.destroy(store.publicId);
    }
    await Store.findByIdAndDelete(id);
    res.status(200).json({ message: `Store with ID ${id} has been deleted` });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// PRODUCT ROUTES (Using your existing cloudinaryUploader)
// ============================================

app.post('/api/products', productUpload.single('productImage'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const { userId, storeId, productName, productPrice, productStock, productCategory, productDescription } = req.body;

  const store = await Store.findOne({ _id: storeId });
  if (!store || store.owner.toString() !== userId) {
    return res.status(403).json({ message: "Unauthorized or invalid store." });
  }

  try {
    const product = await Product.create({
      storeId,
      owner: userId,
      productName,
      productPrice,
      productStock,
      productCategory,
      productDescription,
      productImage: req.file.path,
      publicId: req.file.filename
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("Error saving product:", err);
    res.status(500).json({ message: "Failed to save product" });
  }
});

app.get('/api/products/all', async (req, res) => {
  try {
    const products = await Product.find({});
    for (let i = products.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [products[i], products[j]] = [products[j], products[i]];
    }
    res.status(200).json(products);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/products/id/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    res.status(200).json(product);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

app.get('/api/products/category/:category', async (req, res) => {
  try {
    const products = await Product.find({ productCategory: req.params.category });
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch category products" });
  }
});

app.get('/api/products/:storeId', async (req, res) => {
  const { storeId } = req.params;
  try {
    const products = await Product.find({ storeId });
    res.status(200).json(products);
  } catch (err) {
    console.error("Error fetching store products:", err);
    res.status(500).json({ message: "Failed to fetch store products" });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: `No product found with ID ${id}` });
    }
    if (product.publicId) {
      await cloudinary.uploader.destroy(product.publicId);
    }
    await Product.findByIdAndDelete(id);
    res.status(200).json({ message: `Product with ID ${id} has been deleted` });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// DATABASE CONNECTION
// ============================================

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`UniVerse API is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log("MongoDB connection error:", error.message);
  });