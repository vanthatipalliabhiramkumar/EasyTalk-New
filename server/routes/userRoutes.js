const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getDB } = require('../config/database');
const { getConnectedUsers } = require('../sockets/socketManager');

// Get all users
router.get('/', authMiddleware, async (req, res) => {
  const db = getDB();
  const users = await db.all('SELECT id, full_name, email, avatar, is_online FROM users WHERE id != ?', [req.user.id]);
  res.json({ success: true, users: users.map(u => ({ 
    _id: u.id, fullName: u.full_name, email: u.email, avatar: u.avatar, isOnline: u.is_online 
  })) });
});

// Get online users
router.get('/online', authMiddleware, (req, res) => {
  const connectedUsers = getConnectedUsers();
  const online = Array.from(connectedUsers.values()).map(u => ({ 
    _id: u.userId, fullName: u.userName, avatar: u.userAvatar 
  }));
  res.json({ success: true, count: online.length, users: online });
});

// Get user by ID
router.get('/:id', authMiddleware, async (req, res) => {
  const db = getDB();
  const user = await db.get('SELECT id, full_name, avatar, is_online, streak FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ success: false });
  res.json({ success: true, user: { 
    _id: user.id, fullName: user.full_name, avatar: user.avatar, isOnline: user.is_online, streak: user.streak 
  } });
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  const { fullName, avatar } = req.body;
  const db = getDB();
  if (fullName) await db.run('UPDATE users SET full_name = ? WHERE id = ?', [fullName, req.user.id]);
  if (avatar) await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.user.id]);
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ success: true, user });
});

// Update streak
router.put('/streak', authMiddleware, async (req, res) => {
  const db = getDB();
  await db.run('UPDATE users SET streak = streak + 1 WHERE id = ?', [req.user.id]);
  const user = await db.get('SELECT streak FROM users WHERE id = ?', [req.user.id]);
  res.json({ success: true, streak: user.streak });
});

// Update stats
router.put('/stats', authMiddleware, async (req, res) => {
  const { callDuration, messagesSent } = req.body;
  const db = getDB();
  if (callDuration) {
    await db.run('UPDATE users SET total_minutes = total_minutes + ?, total_calls = total_calls + 1 WHERE id = ?', [callDuration, req.user.id]);
  }
  if (messagesSent) {
    await db.run('UPDATE users SET total_messages = total_messages + ? WHERE id = ?', [messagesSent, req.user.id]);
  }
  res.json({ success: true });
});

module.exports = router;