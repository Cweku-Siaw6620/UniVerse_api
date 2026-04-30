const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();
const { storeUpload, productUpload } = require('./middleware/cloudinaryUploader');
const cloudinary = require('./utils/cloudinary');
//student email verification dependencies
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

//importing the models
const User = require('./models/userModel');
const Product = require('./models/productModel');
const Store = require('./models/storeModel');

// Google OAuth2 Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// REPLACE 'https://your-site-name.netlify.app' with your ACTUAL Netlify URL
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

// Generate a 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Validate if email is from a valid university domain
function isValidStudentEmail(email) {
  if (!email) return false;
  
  const validPatterns = [
    /@st\.ug\.edu\.gh$/i,      // University of Ghana
    /@stu\.knust\.edu\.gh$/i,  // KNUST
    /@stu\.ucc\.edu\.gh$/i,    // UCC
    /@uew\.edu\.gh$/i,         // UEW
    /@uds\.edu\.gh$/i,         // UDS
    /@student\.ashesi\.edu\.gh$/i, // Ashesi
    /@st\.regent\.edu\.gh$/i,  // Regent
    /@edu\.gh$/i,              // Any Ghanaian edu domain
    /\.edu\.[a-z]{2}$/i        // Any international edu domain
  ];
  
  return validPatterns.some(pattern => pattern.test(email));
}

// Send email using Nodemailer
async function sendVerificationEmail(to, verificationCode, userName = '') {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: `"UniVerse" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: '🎓 Verify Your Student Status - UniVerse',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1a472a 0%, #2e8b57 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎓 UniVerse</h1>
          <p style="color: #e8f5e9; margin: 10px 0 0 0;">Student Marketplace</p>
        </div>
        
        <!-- Body -->
        <div style="padding: 30px;">
          <h2 style="color: #1a472a; margin-top: 0;">Hello${userName ? ' ' + userName : ' Student'}!</h2>
          <p style="color: #333; line-height: 1.6;">Your verification code is:</p>
          
          <div style="background: #f0fdf4; padding: 20px; text-align: center; margin: 25px 0; border-radius: 12px; border: 2px dashed #2e8b57;">
            <span style="font-size: 42px; font-weight: bold; letter-spacing: 8px; color: #166534; font-family: monospace;">
              ${verificationCode}
            </span>
          </div>
          
          <p style="color: #333; line-height: 1.6;">This code will expire in <strong>15 minutes</strong>.</p>
          <p style="color: #333; line-height: 1.6;">If you didn't request this, you can safely ignore this email.</p>
          
          <hr style="margin: 25px 0; border-color: #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; text-align: center;">
            UniVerse - Supporting student entrepreneurs across Ghana<br>
            <a href="https://universeweb.netlify.app" style="color: #2e8b57;">Visit our marketplace</a>
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

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
        affiliation: 'external',  // Default to external
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
// VERIFICATION ROUTES (NEW)
// ============================================

// STEP 1: Send 6-digit verification code to student email
app.post('/api/verification/send-code', async (req, res) => {
  try {
    const { userId, studentEmail, university, graduationYear } = req.body;
    
    // Validation
    if (!userId || !studentEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID and student email are required' 
      });
    }
    
    // Check if email is from valid university domain
    if (!isValidStudentEmail(studentEmail)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please use your valid university email address (e.g., name@st.ug.edu.gh)' 
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Generate 6-digit code (expires in 15 minutes)
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    
    // Update user with pending verification status
    user.affiliation = 'student_pending';
    user.studentEmail = studentEmail;
    user.university = university || user.university;
    user.graduationYear = graduationYear || user.graduationYear;
    user.verificationCode = verificationCode;
    user.verificationCodeExpiresAt = expiresAt;
    user.profileCompleted = true;
    
    await user.save();
    
    // Send email with verification code
    await sendVerificationEmail(studentEmail, verificationCode, user.name);
    
    res.json({ 
      success: true, 
      message: 'Verification code sent to your student email!',
      expiresIn: 15
    });
    
  } catch (error) {
    console.error('Send code error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send verification code. Please try again.' 
    });
  }
});

// STEP 2: Verify the 6-digit code user entered
app.post('/api/verification/verify-code', async (req, res) => {
  try {
    const { userId, code } = req.body;
    
    if (!userId || !code) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID and verification code are required' 
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Check if code exists
    if (!user.verificationCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'No verification code found. Please request a new code.' 
      });
    }
    
    // Check if code is expired
    const now = new Date();
    if (now > user.verificationCodeExpiresAt) {
      return res.status(400).json({ 
        success: false, 
        message: 'Verification code has expired. Please request a new one.' 
      });
    }
    
    // Check if code matches
    if (user.verificationCode !== code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid verification code. Please try again.' 
      });
    }
    
    // CODE IS CORRECT! Mark user as verified student
    user.affiliation = 'student_verified';
    user.isVerified = true;
    user.verifiedAt = new Date();
    
    // Clear verification code data
    user.verificationCode = null;
    user.verificationCodeExpiresAt = null;
    
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Student verified successfully! 🎓',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        affiliation: user.affiliation,
        isVerified: user.isVerified
      }
    });
    
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify code. Please try again.' 
    });
  }
});

// STEP 3: Resend verification code
app.post('/api/verification/resend-code', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    if (!user.studentEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'No student email found. Please start over.' 
      });
    }
    
    // Generate new code
    const newCode = generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    
    // Update database
    user.verificationCode = newCode;
    user.verificationCodeExpiresAt = expiresAt;
    await user.save();
    
    // Send email with new code
    await sendVerificationEmail(user.studentEmail, newCode, user.name);
    
    res.json({ 
      success: true, 
      message: 'New verification code sent!',
      expiresIn: 15
    });
    
  } catch (error) {
    console.error('Resend code error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to resend code. Please try again.' 
    });
  }
});

// Check verification status
app.get('/api/verification/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      affiliation: user.affiliation,
      isVerified: user.isVerified,
      studentEmail: user.studentEmail,
      university: user.university,
      profileCompleted: user.profileCompleted
    });
    
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check verification status' 
    });
  }
});

// ============================================
// PROFILE COMPLETION ROUTE (UPDATED)
// ============================================

// Completing profile after google sign in
app.put('/api/auth/google/user/completeProfile', async (req, res) => {
  const { userId, affiliation, university, graduationDate, studentEmail } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.affiliation = affiliation;
    user.profileCompleted = true;

    if (affiliation === "student") {
      // Guard Clause: Check if studentEmail exists
      if (!studentEmail) {
        return res.status(400).json({ message: "Student email is required for verification." });
      }

      // Check if it's an educational email
      if (!isValidStudentEmail(studentEmail)) {
        return res.status(400).json({ message: "Please use a valid student (.edu.gh or .edu) email." });
      }

      user.university = university;
      user.graduationDate = graduationDate;
      user.studentEmail = studentEmail;
      user.isVerified = false;
      
      // Generate a verification token (for link-based verification as backup)
      const token = crypto.randomBytes(32).toString('hex');
      user.verificationToken = token;
      
      // Also generate 6-digit code
      const verificationCode = generateVerificationCode();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);
      user.verificationCode = verificationCode;
      user.verificationCodeExpiresAt = expiresAt;

      // Send Verification Email with both code and link
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { 
          user: process.env.EMAIL_USER, 
          pass: process.env.EMAIL_PASS 
        }
      });

      const verificationUrl = `https://universe-api-u0rj.onrender.com/api/auth/verify-student/${token}`;

      await transporter.sendMail({
        to: studentEmail,
        subject: "🎓 Verify Your UniVerse Student Status",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #2e8b57;">Welcome to UniVerse! 🎓</h2>
            <p>Hello ${user.name},</p>
            <p>Please verify your student status using either method below:</p>
            
            <div style="background: #f0fdf4; padding: 20px; margin: 20px 0; border-radius: 10px;">
              <h3 style="margin-top: 0;">Method 1: 6-Digit Code</h3>
              <p style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #166534;">
                ${verificationCode}
              </p>
              <p>Enter this code on the verification page. Expires in 15 minutes.</p>
            </div>
            
            <div style="background: #f0fdf4; padding: 20px; margin: 20px 0; border-radius: 10px;">
              <h3 style="margin-top: 0;">Method 2: Magic Link</h3>
              <p>Click the button below to verify instantly:</p>
              <a href="${verificationUrl}" 
                 style="display: inline-block; background-color: #2e8b57; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Verify My Student Status
              </a>
            </div>
            
            <p>If you didn't create an account, you can safely ignore this email.</p>
            <hr>
            <p style="color: #6b7280; font-size: 12px;">UniVerse - Student Marketplace</p>
          </div>
        `
      });
      
      await user.save();
      
      return res.status(200).json({ 
        message: "Profile saved! Check your student email for verification code.", 
        user: {
          id: user._id,
          name: user.name,
          affiliation: user.affiliation,
          isVerified: user.isVerified
        }
      });
    }

    // For non-student / external affiliate
    await user.save();
    res.status(200).json({ 
      message: "Profile saved successfully!", 
      user: {
        id: user._id,
        name: user.name,
        affiliation: user.affiliation,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error("CompleteProfile Error:", error);
    res.status(500).json({ message: "Server error", details: error.message });
  }
});

// Link-based verification (backup method)
app.get('/api/auth/verify-student/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).send(`
        <div style="text-align:center; margin-top:50px; font-family:sans-serif;">
          <h1 style="color:#e11d48;">Invalid or Expired Link</h1>
          <p>This verification link is no longer valid. Please try again from your profile settings.</p>
          <a href="https://universeweb.netlify.app/profile.html">Back to UniVerse</a>
        </div>
      `);
    }

    // Update user status
    user.isVerified = true;
    user.affiliation = 'student_verified';
    user.verifiedAt = new Date();
    user.verificationToken = undefined;
    user.verificationCode = undefined;
    user.verificationCodeExpiresAt = undefined;
    await user.save();

    res.redirect('https://universeweb.netlify.app/profile.html?verified=true');

  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).send("A server error occurred during verification.");
  }
});

// ============================================
// USER ROUTES
// ============================================

// Fetching user accounts
app.get('/api/auth/google', async (req, res) => {
  try {
    const user = await User.find({});
    res.status(200).json(user);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

// Fetching a single user by ID
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

// Deleting a user by ID
app.delete('/api/auth/google/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: `No user found with ID ${id}` });
    }
    res.status(200).json({ message: `User with ID ${id} has been deleted` });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// STORE ROUTES
// ============================================

// Saving Stores
app.post('/api/stores', storeUpload.single('storeLogo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const { userId, storeName, sellerName, storeDescription, sellerNumber, personalWebsite } = req.body;
  try {
    const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
      folder: 'store_logos',
      use_filename: true,
      unique_filename: false,
      overwrite: false
    });
    const storeLogoUrl = cloudinaryResult.secure_url;
    const storePublicId = cloudinaryResult.public_id;

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
      storeLogo: storeLogoUrl,
      publicId: storePublicId,
      personalWebsite
    });
    res.status(201).json(store);
  } catch (err) {
    console.error("Error saving store:", err);
    res.status(500).json({ message: "Failed to save store" });
  }
});

// Getting user's store data
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

// Getting a single store by ID
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

// Get store by slug
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

// Checking for store existence
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

// Fetching all stores with random order
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

// Deleting a user's store by ID
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
// PRODUCT ROUTES
// ============================================

// Saving products
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
    const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
      folder: 'product_images',
      use_filename: true,
      unique_filename: false,
      overwrite: false
    });
    const productImageUrl = cloudinaryResult.secure_url;
    const productPublicId = cloudinaryResult.public_id;

    const product = await Product.create({
      storeId,
      owner: userId,
      productName,
      productPrice,
      productStock,
      productCategory,
      productDescription,
      productImage: productImageUrl,
      publicId: productPublicId
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("Error saving product:", err);
    res.status(500).json({ message: "Failed to save product" });
  }
});

// Fetch all products
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

// Getting product by id
app.get('/api/products/id/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    res.status(200).json(product);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// Get products by category
app.get('/api/products/category/:category', async (req, res) => {
  try {
    const products = await Product.find({ productCategory: req.params.category });
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch category products" });
  }
});

// Getting user's product data
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

// Deleting products
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