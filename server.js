const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const app = express();
// const port = process.env.PORT || 4000;

//importing the models
//const User = require('./models/userModel');
const Product = require('./models/productModel');

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

    // You could now check MongoDB here and create user if not exists

    res.status(200).json({
      googleId: sub,
      email,
      name,
      picture
    });

  } catch (error) {
    console.error("Token verification error:", error.message);
    res.status(401).json({ message: "Invalid Google token" });
  }
});











//fetching all data
app.get('/products' , async(req,res) =>{
   try {
        const products = await Product.find({});
        res.status(200).json(products);
   } catch (error) {
        console.log(error.message);
        res.status(500).json({message: error.message});
   }
})

//fetching by ID
app.get('/products/:id' , async(req,res) =>{
    try {
        const {id} = req.params;
         const product = await Product.findById(id);
         res.status(200).json(product);
    } catch (error) {
         console.log(error.message);
         res.status(500).json({message: error.message});
    }
 })

 // Fetching products by brand
app.get('/products/brand/:brand', async (req, res) => {
    try {
        const { brand } = req.params;
        const products = await Product.find({ brand: brand });  // Fetch products by brand
        if (!products.length) {
            return res.status(404).json({ message: `No products found for brand ${brand}` });
        }
        res.status(200).json(products);
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: error.message });
    }
});

//saving data
app.post('/products' , async(req,res) =>{
    try {
        const products = await Product.create(req.body);
        res.status(200).json(products);
    } catch (error) {
        console.log(error.message);
        res.status(500).json({message: error.message});
    }
})


//updating a product
app.put('/products/:id' , async(req,res) =>{
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndUpdate(id, req.body);

        if (!product) {
            return res.status(404).json({ message: `No product found with ID ${id}` });
        }
        res.status(200).json(product);

    } catch (error) {
        console.log(error.message);
        res.status(500).json({message: error.message});
    }
})


// Deleting a product by ID
app.delete('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndDelete(id);  // Find the product by ID and delete it

        if (!product) {
            return res.status(404).json({ message: `No product found with ID ${id}` });
        }

        res.status(200).json({ message: `Product with ID ${id} has been deleted` });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: error.message });
    }
});


mongoose.connect('mongodb+srv://kelvinashong02:qwerty111@universe.y8my3b4.mongodb.net/?retryWrites=true&w=majority&appName=UniVerse')
.then(()=>{
    console.log("connected to mongodb");
    app.listen(3000, ()=>{
        console.log('Cictech APi is runing on port 3000');
    })
}).catch((error) => {  // ✅ include (error)
  console.log("MongoDB connection error:", error.message);
});


