// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    diseaseOfInterest: { 
        type: String, 
        required: true,
        trim: true 
    },
    location: { 
        type: String, 
        default: 'Not specified',
        trim: true
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('User', UserSchema);