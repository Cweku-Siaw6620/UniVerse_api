const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();
const upload = require('./middleware/cloudinaryUploader')
const cloudinary = require('./utils/cloudinary')


const app = express();
const PORT = process.env.PORT || 3000;

//importing the models
const User = require('./models/userModel');
const Product = require('./models/productModel');
const Store = require('./models/storeModel')

// Google OAuth2 Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

//middleware
app.use(cors())
app.use(express.json());
app.use(bodyParser.json());


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

    // Save or find user
    let user = await User.findOne({ googleId: sub });

    if (!user) {
      user = await User.create({ googleId: sub, email, name, picture });
    }

    // You could now check MongoDB here and create user if not exists

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      picture: user.picture
    });

  } catch (error) {
    console.error("Token verification error:", error.message);
    res.status(401).json({ message: "Invalid Google token" });
  }
});

//fetching user accounts
app.get('/api/auth/google' , async(req,res) =>{
    try {
         const user = await User.find({});
         res.status(200).json(user);
    } catch (error) {
         console.log(error.message);
         res.status(500).json({message: error.message});
    }
 })

  // Deleting a user by ID
app.delete('/api/auth/google/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByIdAndDelete(id);  // Find the user by ID and delete it

        if (!user) {
            return res.status(404).json({ message: `No user found with ID ${id}` });
        }

        res.status(200).json({ message: `User with ID ${id} has been deleted` });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: error.message });
    }
});


//saving Stores
app.post('/api/stores', upload.single('storeLogo'), async (req, res) => {
   if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const { userId,storeName,sellerName, storeDescription, sellerNumber } = req.body;
   try {
    // Upload the store logo to Cloudinary
    const cloudinaryResult = await cloudinary.uploader.upload(req.file.path);
    const storeLogoUrl = cloudinaryResult.secure_url;


  const user = await User.findById(userId);
if (!user) return res.status(404).json({ message: "User not found" });

// Optionally: prevent multiple stores per user
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
      storeLogo : storeLogoUrl,
    });
    res.status(201).json(store);
  } catch (err) {
    console.error("Error saving store:", err);
    res.status(500).json({ message: "Failed to save store" });
  }
});

//getting user's store data
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

// try
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


 // Deleting a user's store by ID
app.delete('/api/stores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const store = await Store.findByIdAndDelete(id);  // Find the store by ID and delete it

        if (!store) {
            return res.status(404).json({ message: `No store found with ID ${id}` });
        }

        res.status(200).json({ message: `Store with ID ${id} has been deleted` });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: error.message });
    }
});


//saving products
app.post('/api/products', async (req, res) => {
  const { userId, storeId, productName, price, image } = req.body;

  // Optional: verify store belongs to user
    const store = await Store.findOne({ _id: storeId, userId });
    if (!store) {
      return res.status(403).json({ message: "Unauthorized or invalid store." });
    }

  try {
    const product = await Product.create({
      storeId,
      owner: userId,
      productName,
      price,
      image
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("Error saving product:", err);
    res.status(500).json({ message: "Failed to save product" });
  }
});

//getting user's product data
app.get('/api/products/user/:userId', async (req, res) => {
  try {
    const stores = await Store.find({ owner: req.params.userId }).select('_id');
    const storeIds = stores.map(s => s._id);
    const products = await Product.find({ storeId: { $in: storeIds } });
    res.status(200).json(products);
  } catch (err) {
    console.error("Error fetching user products:", err);
    res.status(500).json({ message: "Failed to fetch user products" });
  }
});



mongoose.connect('mongodb+srv://kelvinashong02:qwerty111@universe.y8my3b4.mongodb.net/?retryWrites=true&w=majority&appName=UniVerse')
.then(()=>{
    console.log("connected to mongodb");
    app.listen(PORT, ()=>{
        console.log('Cictech APi is runing on port 3000');
    })
}).catch((error) => {  // ✅ include (error)
  console.log("MongoDB connection error:", error.message);
});


