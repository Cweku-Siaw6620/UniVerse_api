const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();
const {storeUpload, productUpload} = require('./middleware/cloudinaryUploader');
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
app.post('/api/stores', storeUpload.single('storeLogo'), async (req, res) => {
   if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const { userId,storeName,sellerName, storeDescription, sellerNumber } = req.body;
   try {
    // Upload the store logo to Cloudinary
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
      publicId: storePublicId
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

//getting a single store by ID
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



// checking for store existence.
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

//fetch all stores
app.get('/api/stores', async (req, res) => {
    try {
         const stores = await Store.find({});
          res.status(200).json(stores);
    } catch (error) {
         console.log(error.message);
         res.status(500).json({message: error.message});
    }
  })

// Deleting a user's store by ID
app.delete('/api/stores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const store = await Store.findById(id);  // Find the store by ID and delete it

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


//saving products
app.post('/api/products', productUpload.single('productImage'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  };

  const { userId, storeId, productName, productPrice, productStock, productCategory, productDescription } = req.body;

  // Optional: verify store belongs to user
    const store = await Store.findOne({ _id: storeId });
    if (!store || store.owner.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized or invalid store." });
    }

  try {
    // Upload the product image to Cloudinary
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

//fetch all products
app.get('/api/products/all', async (req, res) => {
  try {
         const products = await Product.find({});
          res.status(200).json(products);
    } catch (error) {
         console.log(error.message);
         res.status(500).json({message: error.message});
    }
})

//getting product by id
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
})

//getting user's product data
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

//Deleting products
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);  // Find the store by ID and delete it

        if (!product) {
            return res.status(404).json({ message: `No product found with ID ${id}` });
        }

        // ✅ Delete image from Cloudinary using publicId
        if (product.publicId) {
        await cloudinary.uploader.destroy(product.publicId);
        }
        // ✅ Then delete the product from DB
        await Product.findByIdAndDelete(id);

        res.status(200).json({ message: `Product with ID ${id} has been deleted` });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: error.message });
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


