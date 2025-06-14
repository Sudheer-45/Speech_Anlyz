const User = require('../models/User');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler')
const bcrypt = require('bcryptjs')

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '1h', // Token expires in 1 hour
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    user = await User.create({
      username,
      email,
      password,
    });

    res.status(201).json({
      message: 'User registered successfully. Please log in.',
      // In a real app, you might not send token immediately after register
      // token: generateToken(user._id),
      // user: {
      //   _id: user._id,
      //   username: user.username,
      //   email: user.email,
      // },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        message: 'Logged in successfully!',
        token: generateToken(user._id),
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
        },
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getMe = asyncHandler(async (req, res) => {
  // req.user is populated by the protect middleware based on the token
  const user = await User.findById(req.user._id).select('-password'); // Exclude password field

  if (user) {
    res.status(200).json({
      user: { // Send back the user data nested under 'user' key
        _id: user._id,
        username: user.username,
        email: user.email,
        // Add any other user details you want to expose to the frontend
      }
    });
  } else {
    res.status(404);
    throw new Error('User not found'); // Should not happen if token was valid
  }
});

module.exports = { registerUser, loginUser,getMe };