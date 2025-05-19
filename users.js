const express = require('express');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());

const User = require('./models/userModel');


app.post("/", async(req,res)=>{
    let user = new User(req.body);
    let result = await user.save();
    res.send(result);
})

mongoose.connect('mongodb+srv://cictech_electronics:CictechCentral@cictechapi.fsyh2.mongodb.net/CictechApi?retryWrites=true&w=majority&appName=cictechApi')
.then(()=>{
    console.log("connected to mongodb");
    app.listen(3000, ()=>{
        console.log('Users is runing on port 3000');
    })
}).catch(()=>{
    console.log(error);
})