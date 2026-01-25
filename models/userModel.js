const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  name: String,
  email: { type: String, required: true, unique: true },
  picture: String,

  affiliation: {
    type: String,
    enum: ["student", "non-student"],
    default: null
  },

  university: {
    type: String,
    default: null
  },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
