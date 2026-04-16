// backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/setup', async (req, res) => {
    try {
        const { name, diseaseOfInterest, location } = req.body;
        // Create a new user profile in MongoDB
        const newUser = new User({ name, diseaseOfInterest, location });
        await newUser.save();
        res.status(201).json({ success: true, user: newUser });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;