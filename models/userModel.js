const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const usersSchema = new mongoose.Schema({
    storeName: { type: String, required: true },
    sellerName: { type: String, required: true, unique: true },
    sellerNumber: {type: String, required: true, unique: true},
    password: { type: String, required: true }
});

usersSchema.pre('save', async function (next) {
    try {
        // Only hash the password if it is new or modified
        if (!this.isModified('password')) return next();

        // Generate a salt and hash the password
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);

        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model("Users",usersSchema);