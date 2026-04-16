// backend/models/Chat.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    role: { 
        type: String, 
        enum: ['user', 'assistant', 'system'], 
        required: true 
    },
    content: { 
        type: String, 
        required: true 
    },
    // We attach the retrieved sources ONLY to the assistant's responses
    sources: [{
        title: { type: String },
        url: { type: String },
        sourceType: { type: String }, // e.g., 'PubMed', 'ClinicalTrials.gov'
        year: { type: String }
    }],
    timestamp: { 
        type: Date, 
        default: Date.now 
    }
});

const ChatSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    // The array of messages gives our local LLM its "memory"
    messages: [MessageSchema]
}, {
    // This single line replaces the entire pre-save hook and handles both createdAt and updatedAt automatically!
    timestamps: true 
});

module.exports = mongoose.model('Chat', ChatSchema);