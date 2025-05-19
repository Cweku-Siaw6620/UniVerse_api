const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// const port = process.env.PORT || 4000;

//importing the models
const User = require('./models/userModel');
const Product = require('./models/productModel');

const app = express();

//middleware
app.use(cors())
app.use(express.json());

//saving users accounts
app.post("/users", async(req,res)=>{
    let user = new User(req.body);
    let result = await user.save();
    res.send(result);
})
  

//fetching user accounts
app.get('/users' , async(req,res) =>{
    try {
         const users = await User.find({});
         res.status(200).json(users);
    } catch (error) {
         console.log(error.message);
         res.status(500).json({message: error.message});
    }
 })
 
//deleting user account
app.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByIdAndDelete(id);  // Find the product by ID and delete it

        if (!user) {
            return res.status(404).json({ message: `No user found with ID ${id}` });
        }

        res.status(200).json({ message: `User with ID ${id} has been deleted` });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: error.message });
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
}).catch(()=>{
    console.log(error);
})


