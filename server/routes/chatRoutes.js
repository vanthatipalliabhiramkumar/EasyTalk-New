const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getRecentChats,
  markDelivered,
  deleteMessage
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.post('/send', protect, sendMessage);
router.get('/recent', protect, getRecentChats);
router.get('/:userId', protect, getMessages);
router.put('/delivered/:messageId', protect, markDelivered);
router.delete('/:messageId', protect, deleteMessage);

module.exports = router;