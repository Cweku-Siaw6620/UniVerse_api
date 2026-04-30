// models/userModel.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  name: String,
  email: { type: String, required: true, unique: true },
  picture: String,

  affiliation: {
    type: String,
    enum: ["student", "external", "student_pending", "student_verified"],
    default: "external"
  },

  university: {
    type: String,
    default: null
  },
  
  // NEW: Student ID Card Verification Fields
  studentIdCard: {
    frontImage: { type: String, default: null },      // Cloudinary URL for front
    backImage: { type: String, default: null },       // Cloudinary URL for back
    frontPublicId: { type: String, default: null },   // For deletion
    backPublicId: { type: String, default: null },    // For deletion
    expiryDate: { type: Date, default: null },        // When ID card expires
    submittedAt: { type: Date, default: null },       // When they submitted
    verifiedAt: { type: Date, default: null },        // When admin verified
    rejectedAt: { type: Date, default: null },        // If rejected
    rejectionReason: { type: String, default: null }  // Why rejected
  },
  
  // Verification status
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  
  profileCompleted: {
    type: Boolean,
    default: false
  }
  
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);