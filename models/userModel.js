const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  name: String,
  email: { type: String, required: true, unique: true },
  picture: String,

  affiliation: {
    type: String,
    enum: ["student", "non-student", "external", "student_pending", "student_verified"],
    default: "external"  // Changed from null to "external"
  },

  university: {
    type: String,
    default: null
  },
  
  studentEmail: {
    type: String,
    default: null
  },
  
  graduationDate: {
    type: Date,
    default: null
  },
  
  graduationYear: {
    type: Number,
    default: null
  },
  
  // Verification fields
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  
  verificationToken: { 
    type: String,
    default: null
  },
  
  // NEW FIELDS for 6-digit code verification
  verificationCode: {
    type: String,
    default: null
  },
  
  verificationCodeExpiresAt: {
    type: Date,
    default: null
  },
  
  verifiedAt: {
    type: Date,
    default: null
  },
  
  // Store whether user completed profile
  profileCompleted: {
    type: Boolean,
    default: false
  }
  
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);