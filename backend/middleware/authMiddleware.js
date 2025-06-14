const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User'); // Ensure this path is correct

const protect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            console.log('Received Token (protect):', token); // Debugging
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Decoded JWT (protect):', decoded); // Debugging
            req.user = await User.findById(decoded.id).select('-password'); // Fetch user without password
            console.log('Found User (protect):', req.user ? req.user._id : 'Not found'); // Debugging
            if (!req.user) {
                res.status(401);
                throw new Error('Not authorized, user not found');
            }
            next();
        } catch (error) {
            console.error('Token verification failed (protect):', error.message); // Debugging
            res.status(401);
            throw new Error('Not authorized, token failed');
        }
    } else {
        console.error('No Authorization header or invalid format (protect)'); // Debugging
        res.status(401);
        throw new Error('Not authorized, no token');
    }
});

module.exports = { protect };
