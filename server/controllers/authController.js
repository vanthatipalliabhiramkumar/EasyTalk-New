const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');

const register = async (req, res) => {
  try {
    const { fullName, email, mobileNumber, password, gender, state } = req.body;
    if (!fullName || !email) {
      return res.status(400).json({ success: false, message: 'Name and email required' });
    }
    
    const db = getDB();
    const existing = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    
    if (existing) {
      const token = jwt.sign({ id: existing.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      return res.json({ success: true, token, user: {
        _id: existing.id, fullName: existing.full_name, email: existing.email,
        avatar: existing.avatar, streak: existing.streak,
        totalCalls: existing.total_calls, totalMinutes: existing.total_minutes, totalMessages: existing.total_messages
      }});
    }
    
    const userId = uuidv4();
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=4F46E5&color=fff&size=100`;
    
    await db.run(
      `INSERT INTO users (id, full_name, email, mobile_number, password, gender, state, avatar) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, fullName, email, mobileNumber || '', hashedPassword, gender || 'Other', state || '', avatar]
    );
    
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ success: true, token, user: {
      _id: userId, fullName, email, avatar, streak: 0, totalCalls: 0, totalMinutes: 0, totalMessages: 0
    }});
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = getDB();
    let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      const userId = uuidv4();
      const fullName = email.split('@')[0];
      const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=4F46E5&color=fff&size=100`;
      await db.run(`INSERT INTO users (id, full_name, email, avatar) VALUES (?, ?, ?, ?)`, [userId, fullName, email, avatar]);
      user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    }
    
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: {
      _id: user.id, fullName: user.full_name, email: user.email, avatar: user.avatar,
      streak: user.streak, totalCalls: user.total_calls, totalMinutes: user.total_minutes,
      totalMessages: user.total_messages, challengesCompleted: user.challenges_completed
    }});
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMe = (req, res) => {
  res.json({ success: true, user: {
    _id: req.user.id, fullName: req.user.full_name, email: req.user.email, avatar: req.user.avatar,
    streak: req.user.streak, totalCalls: req.user.total_calls, totalMinutes: req.user.total_minutes,
    totalMessages: req.user.total_messages, challengesCompleted: req.user.challenges_completed
  }});
};

const logout = async (req, res) => {
  const db = getDB();
  await db.run('UPDATE users SET is_online = 0 WHERE id = ?', [req.user.id]);
  res.json({ success: true });
};

module.exports = { register, login, getMe, logout };