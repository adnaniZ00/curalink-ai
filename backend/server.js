// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express App
const app = express();

// Middleware
// Open CORS policy to ensure it accepts requests from anywhere (e.g. Vercel, Netlify frontend)
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
app.use(express.json()); // Parses incoming JSON requests
app.use(express.urlencoded({ extended: true }));

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connection Established Successfully'))
    .catch((err) => {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1); // Exit process with failure
    });

// Basic Health Check Route
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'Active', 
        message: 'OmniMed Backend Engine is running.',
        timestamp: new Date().toISOString()
    });
});

// Add this under your basic health check route in server.js
app.use('/api/chat', require('./routes/chatRoutes'));

app.use('/api/users', require('./routes/userRoutes'));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: err.message
    });
});

// Start the Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 OmniMed Backend running and ready for production on port ${PORT}`);
});