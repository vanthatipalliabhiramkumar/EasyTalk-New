const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { chatWithAI, getConversations, deleteConversation } = require('../controllers/aiController');

router.post('/chat', authMiddleware, chatWithAI);
router.get('/conversations', authMiddleware, getConversations);
router.delete('/conversations/:id', authMiddleware, deleteConversation);

module.exports = router;