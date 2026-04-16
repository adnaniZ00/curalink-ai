// backend/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const { handleUserMessage } = require('../controllers/chatController');

// POST /api/chat/message
router.post('/message', handleUserMessage);

module.exports = router;