// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For generating JWTs
const User = require('../models/User'); // Your User Mongoose model
const { protect } = require('../middleware/authMiddleware'); // Import your protect middleware
const asyncHandler = require('express-async-handler'); // For simplifying async error handling

// 1. Nodemailer Transporter Configuration
// --- DEBUGGING LOGS FOR TRANSPORTER ---
console.log('Nodemailer config:');
console.log('  EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('  EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('  EMAIL_USER:', process.env.EMAIL_USER);
// console.log('  EMAIL_PASS:', process.env.EMAIL_PASS); // Do NOT log password in production!
// --- END DEBUGGING LOGS ---

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST, // Should now correctly be smtp.gmail.com
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465, // true for 465, false for 587 (current setup)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false // Only for development; remove in production with valid certs
    }
});

// 2. sendWelcomeEmail Function
const sendWelcomeEmail = async (userEmail, userName) => {
    try {
        const mailOptions = {
            from: `"Comm Analyzer" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: 'Welcome to Comm Analyzer! 🎉',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
                    <h2 style="color: #0d6efd; text-align: center;">Welcome, ${userName || 'New User'}!</h2>
                    <p>Thank you for joining Comm Analyzer!</p>
                    <p>We're thrilled to have you as part of our community. Comm Analyzer is designed to empower you with insightful communication analysis tools.</p>
                    <p>Here are some things you can do to get started:</p>
                    <ul style="list-style-type: disc; margin-left: 20px;">
                        <li>Explore your <a href="http://localhost:5173/dashboard" style="color: #0d6efd; text-decoration: none;">Dashboard</a></li>
                        <li>Check out our <a href="http://localhost:5173/tutoring" style="color: #0d6efd; text-decoration: none;">Personal Development Hub</a></li>
                        <li>Update your <a href="http://localhost:5173/profile" style="color: #0d6efd; text-decoration: none;">Profile</a></li>
                    </ul>
                    <p>If you have any questions or need support, feel free to contact us at <a href="mailto:${process.env.EMAIL_USER}" style="color: #0d6efd; text-decoration: none;">${process.env.EMAIL_USER}</a>.</p>
                    <p style="margin-top: 20px; text-align: center; color: #777;">Best regards,<br>The Comm Analyzer Team</p>
                    <p style="font-size: 0.8em; text-align: center; color: #aaa;">&copy; ${new Date().getFullYear()} Comm Analyzer. All rights reserved.</p>
                </div>
            `,
        };

        let info = await transporter.sendMail(mailOptions);
        console.log('Welcome message sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('Error sending welcome email:', error);
        if (error.response) {
            console.error('Nodemailer SMTP Error:', error.response);
        }
        return { success: false, error: error.message };
    }
};

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '1h', // Token expires in 1 hour
    });
};

// @desc    Register new user
// @route   POST /api/auth/signup
// @access  Public
router.post('/signup', asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    // Check if user exists
    const userExists = await User.findOne({ email: email.toLowerCase() }); 

    console.log('Signup attempt for email:', email); // Debugging
    console.log('User found during signup check:', userExists ? userExists.email : 'None'); // Debugging

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
        username,
        email: email.toLowerCase(), // Store email in lowercase
        password: hashedPassword,
    });

    if (user) {
        // Trigger email sending asynchronously without awaiting it.
        sendWelcomeEmail(user.email, user.username).catch(err => 
            console.error('Error sending welcome email asynchronously:', err)
        );

        res.status(201).json({
            _id: user.id,
            username: user.username,
            email: user.email,
            token: generateToken(user._id),
            message: 'User registered successfully!'
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
}));


// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Check for user email (convert to lowercase for consistent lookup)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password'); 

    console.log('Login attempt for email:', email); // Debugging
    console.log('User found in DB (login):', user ? user.email : 'None'); // Debugging

    // Check if user exists and password hash is retrieved
    if (user && user.password) { 
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Plain password received:', password); // Debugging
        console.log('Hashed password from DB:', user.password); // Debugging
        console.log('Password comparison result (bcrypt.compare):', isMatch); // Debugging

        if (isMatch) {
            res.json({
                _id: user.id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id),
                message: 'Logged in successfully!'
            });
        } else {
            res.status(400);
            throw new Error('Invalid credentials'); // Password mismatch
        }
    } else {
        // This handles cases where user is not found, or password field is missing (e.g., if .select('+password') is forgotten)
        res.status(400);
        throw new Error('Invalid credentials'); // User not found or password not retrievable
    }
}));

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, asyncHandler(async (req, res) => {
    // req.user is set by the protect middleware. It contains user data from the DB
    // excluding the password.
    if (req.user) {
        res.status(200).json({
            id: req.user._id,
            username: req.user.username,
            email: req.user.email
            // Add other user fields you want to expose to the frontend
        });
    } else {
        // This case should ideally not be reached if 'protect' middleware works correctly.
        res.status(401);
        throw new Error('Not authorized, user data not found after token verification.');
    }
}));


module.exports = router;
