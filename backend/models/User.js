// models/User.js
const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  bio: {
    type: String,
    default: '',
  },
  profilePictureUrl: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Other fields.


        // You might have other fields like:
        // createdAt: { type: Date, default: Date.now },
        // isAdmin: { type: Boolean, default: false },
        // profileImage: { type: String },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt timestamps automatically
    }
);

// Optional: You can also hash password before saving here if you prefer
// userSchema.pre('save', async function (next) {
//     if (!this.isModified('password')) {
//         next();
//     }
//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);
// });

module.exports = mongoose.model('User', userSchema);
