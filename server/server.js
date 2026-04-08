const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== DATABASE SETUP ====================
const dbPath = path.join(__dirname, 'easytalk.db');
const db = new sqlite3.Database(dbPath);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create all tables with proper schema
db.serialize(() => {
  // ========== USERS TABLE ==========
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    gender TEXT,
    avatar TEXT,
    is_online INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    total_calls INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    email_verified INTEGER DEFAULT 0,
    verification_token TEXT,
    reset_token TEXT,
    reset_token_expiry DATETIME,
    last_active DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ========== MESSAGES TABLE ==========
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    is_delivered INTEGER DEFAULT 0,
    read_at DATETIME,
    delivered_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // ========== CHALLENGES TABLE ==========
  db.run(`CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    target_value INTEGER DEFAULT 20,
    unit TEXT DEFAULT 'minutes',
    points INTEGER DEFAULT 100,
    difficulty TEXT DEFAULT 'beginner',
    icon TEXT DEFAULT '🎙️',
    tip TEXT,
    category TEXT DEFAULT 'speaking',
    is_daily INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ========== USER CHALLENGES TABLE ==========
  db.run(`CREATE TABLE IF NOT EXISTS user_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    challenge_id TEXT NOT NULL,
    current_progress INTEGER DEFAULT 0,
    status TEXT DEFAULT 'not_started',
    response TEXT,
    score INTEGER DEFAULT 0,
    feedback TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, challenge_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
  )`);

  // ========== AI CONVERSATIONS TABLE ==========
  db.run(`CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    messages TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // ========== CALL HISTORY TABLE ==========
  db.run(`CREATE TABLE IF NOT EXISTS call_history (
    id TEXT PRIMARY KEY,
    caller_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    call_type TEXT DEFAULT 'audio',
    duration INTEGER DEFAULT 0,
    status TEXT DEFAULT 'missed',
    started_at DATETIME,
    ended_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // ========== FRIENDS TABLE ==========
  db.run(`CREATE TABLE IF NOT EXISTS friends (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // ========== NOTIFICATIONS TABLE ==========
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // ========== INSERT DEFAULT CHALLENGES ==========
  db.get("SELECT COUNT(*) as count FROM challenges", (err, row) => {
    if (!err && row && row.count === 0) {
      const challenges = [
        ['ch_1', 'Talk for 20 Minutes', 'Practice speaking English continuously for 20 minutes. This beginner-friendly challenge helps build your confidence in everyday conversations.', 20, 'minutes', 100, 'beginner', '🎙️', 'Start with simple topics like your daily routine, hobbies, or favorite movies. Don\'t worry about mistakes - just keep talking!', 'speaking', 1],
        ['ch_2', 'Talk for 45 Minutes', 'Take your speaking skills to the next level with 45 minutes of continuous English conversation. Perfect for intermediate learners.', 45, 'minutes', 200, 'intermediate', '🎤', 'Discuss current events, share opinions, or tell a story. Try to use new vocabulary words you\'ve learned.', 'speaking', 0],
        ['ch_3', 'Talk for 90 Minutes', 'Master advanced fluency with 90 minutes of deep conversation. This challenge is for confident speakers ready to level up.', 90, 'minutes', 350, 'advanced', '🎧', 'Have deep conversations about philosophy, technology, or your life experiences. Focus on expressing complex ideas clearly.', 'speaking', 0],
        ['ch_4', 'Grammar Master: Present Tense', 'Practice using present simple and present continuous tense correctly in conversation.', 15, 'minutes', 80, 'beginner', '📚', 'Use sentences like "I study English daily" and "I am learning right now".', 'grammar', 0],
        ['ch_5', 'Vocabulary Builder: 50 Words', 'Learn and use 50 new vocabulary words in context during your conversation.', 30, 'minutes', 150, 'intermediate', '📖', 'Keep a list of new words and try to use each one at least once.', 'vocabulary', 0],
        ['ch_6', 'Pronunciation Perfection', 'Focus on perfecting your pronunciation of difficult sounds like "th", "r", and "l".', 25, 'minutes', 120, 'intermediate', '🎤', 'Practice words like "think", "through", "world", and "literally".', 'pronunciation', 0]
      ];
      const stmt = db.prepare(`INSERT INTO challenges (id, title, description, target_value, unit, points, difficulty, icon, tip, category, is_daily) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      challenges.forEach(c => stmt.run(c));
      stmt.finalize();
      console.log('✅ 6 Default challenges inserted');
    }
  });
});

console.log('✅ Database connected with all tables');

// ==================== HELPER FUNCTIONS ====================
const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// ==================== JWT CONFIGURATION ====================
const JWT_SECRET = 'easy-talk-super-secret-key-2024';
const JWT_REFRESH_SECRET = 'easy-talk-refresh-secret-key-2024';
const TOKEN_EXPIRY = '30d';
const REFRESH_TOKEN_EXPIRY = '60d';

// Generate tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ id: userId }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

// ==================== STORES FOR REAL-TIME DATA ====================
const onlineUsers = new Map(); // userId -> { socketId, userName, userAvatar, userId }
const chatQueue = []; // Users waiting for random chat
const callQueue = []; // Users waiting for random call
const activeChats = new Map(); // chatId -> { user1, user2, user1Name, user2Name, user1Avatar, user2Avatar, socket1, socket2, startedAt }
const activeCalls = new Map(); // callId -> { callerId, receiverId, callerName, receiverName, callerAvatar, receiverAvatar, callerSocket, receiverSocket, callType, status, startedAt }
const typingUsers = new Map(); // chatId -> Set of typing users

// ==================== AUTH MIDDLEWARE ====================
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getQuery('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, gender } = req.body;
    console.log('📝 Registration attempt:', { name, email });
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }
    if (name.length < 2) {
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ success: false, message: 'Valid email required' });
    }
    
    const existingUser = await getQuery('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff&size=100`;
    
    await runQuery(
      'INSERT INTO users (id, name, email, password, gender, avatar, points) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, name, email.toLowerCase(), hashedPassword, gender || 'Other', avatar, 0]
    );
    
    const { accessToken, refreshToken } = generateTokens(userId);
    
    console.log('✅ User registered successfully:', name);
    
    res.status(201).json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        id: userId,
        name: name,
        email: email.toLowerCase(),
        avatar: avatar,
        streak: 0,
        totalCalls: 0,
        totalMessages: 0,
        points: 0
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Login attempt:', { email });
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    
    const user = await getQuery('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    
    const { accessToken, refreshToken } = generateTokens(user.id);
    
    // Update last active
    await runQuery('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    
    console.log('✅ User logged in:', user.name);
    
    res.json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        streak: user.streak || 0,
        totalCalls: user.total_calls || 0,
        totalMessages: user.total_messages || 0,
        points: user.points || 0
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/auth/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }
    
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
    
    const user = await getQuery('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);
    
    res.json({
      success: true,
      token: accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      streak: req.user.streak || 0,
      totalCalls: req.user.total_calls || 0,
      totalMessages: req.user.total_messages || 0,
      points: req.user.points || 0
    }
  });
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  await runQuery('UPDATE users SET is_online = 0 WHERE id = ?', [req.user.id]);
  res.json({ success: true });
});

// ==================== USER ROUTES ====================
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const users = await allQuery('SELECT id, name, email, avatar, points, streak, total_calls, total_messages FROM users WHERE id != ?', [req.user.id]);
    const usersWithOnlineStatus = users.map(user => ({
      ...user,
      isOnline: onlineUsers.has(user.id)
    }));
    res.json({ success: true, users: usersWithOnlineStatus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/users/online', authMiddleware, (req, res) => {
  const online = Array.from(onlineUsers.values()).map(u => ({ 
    id: u.userId, 
    name: u.userName, 
    avatar: u.userAvatar 
  }));
  res.json({ success: true, count: online.length, users: online });
});

app.get('/api/users/:userId', authMiddleware, async (req, res) => {
  try {
    const user = await getQuery('SELECT id, name, email, avatar, points, streak, total_calls, total_messages FROM users WHERE id = ?', [req.params.userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/users/profile', authMiddleware, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    if (name) {
      await runQuery('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);
    }
    if (avatar) {
      await runQuery('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.user.id]);
    }
    
    const updatedUser = await getQuery('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== FRIEND ROUTES ====================
app.post('/api/friends/request', authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.body;
    const existing = await getQuery('SELECT * FROM friends WHERE user_id = ? AND friend_id = ?', [req.user.id, friendId]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Friend request already sent' });
    }
    
    await runQuery('INSERT INTO friends (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)', [uuidv4(), req.user.id, friendId, 'pending']);
    
    // Notify the friend
    const friend = onlineUsers.get(friendId);
    if (friend) {
      io.to(friend.socketId).emit('friend_request_received', {
        fromUserId: req.user.id,
        fromUserName: req.user.name,
        fromUserAvatar: req.user.avatar
      });
    }
    
    res.json({ success: true, message: 'Friend request sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/friends/accept', authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.body;
    await runQuery('UPDATE friends SET status = "accepted", updated_at = CURRENT_TIMESTAMP WHERE id = ? AND friend_id = ?', [requestId, req.user.id]);
    res.json({ success: true, message: 'Friend request accepted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/friends', authMiddleware, async (req, res) => {
  try {
    const friends = await allQuery(
      `SELECT u.id, u.name, u.avatar, u.is_online, f.status 
       FROM friends f 
       JOIN users u ON (f.user_id = u.id OR f.friend_id = u.id) 
       WHERE (f.user_id = ? OR f.friend_id = ?) AND u.id != ? AND f.status = "accepted"`,
      [req.user.id, req.user.id, req.user.id]
    );
    res.json({ success: true, friends });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== CHAT MESSAGE ROUTES ====================
app.post('/api/chat/send', authMiddleware, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    
    if (!receiverId || !content) {
      return res.status(400).json({ success: false, message: 'Receiver ID and content required' });
    }
    
    const messageId = uuidv4();
    await runQuery(
      'INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)',
      [messageId, req.user.id, receiverId, content]
    );
    
    await runQuery('UPDATE users SET total_messages = total_messages + 1 WHERE id = ?', [req.user.id]);
    
    const receiver = onlineUsers.get(receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit('new_message', {
        id: messageId,
        content,
        senderId: req.user.id,
        senderName: req.user.name,
        senderAvatar: req.user.avatar,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({ success: true, message: { id: messageId, content, createdAt: new Date().toISOString() } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/chat/:userId', authMiddleware, async (req, res) => {
  try {
    const messages = await allQuery(
      `SELECT m.*, u.name as sender_name, u.avatar as sender_avatar 
       FROM messages m 
       JOIN users u ON m.sender_id = u.id 
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) 
       ORDER BY created_at ASC`,
      [req.user.id, req.params.userId, req.params.userId, req.user.id]
    );
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/chat/recent', authMiddleware, async (req, res) => {
  try {
    const messages = await allQuery(
      `SELECT m.*, 
        CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as other_user_id,
        u.name as other_user_name,
        u.avatar as other_user_avatar
       FROM messages m 
       JOIN users u ON u.id = (CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END)
       WHERE m.sender_id = ? OR m.receiver_id = ?
       ORDER BY m.created_at DESC`,
      [req.user.id, req.user.id, req.user.id, req.user.id]
    );
    
    const uniqueChats = new Map();
    messages.forEach(m => {
      if (!uniqueChats.has(m.other_user_id)) {
        uniqueChats.set(m.other_user_id, {
          userId: m.other_user_id,
          name: m.other_user_name,
          avatar: m.other_user_avatar,
          lastMessage: m.content,
          lastMessageTime: m.created_at,
          isOnline: onlineUsers.has(m.other_user_id)
        });
      }
    });
    
    res.json({ success: true, chats: Array.from(uniqueChats.values()) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/chat/read/:userId', authMiddleware, async (req, res) => {
  try {
    await runQuery(
      'UPDATE messages SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
      [req.params.userId, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== CALL HISTORY ROUTES ====================
app.get('/api/calls/history', authMiddleware, async (req, res) => {
  try {
    const history = await allQuery(
      `SELECT c.*, 
        u1.name as caller_name, u1.avatar as caller_avatar,
        u2.name as receiver_name, u2.avatar as receiver_avatar
       FROM call_history c
       JOIN users u1 ON c.caller_id = u1.id
       JOIN users u2 ON c.receiver_id = u2.id
       WHERE c.caller_id = ? OR c.receiver_id = ?
       ORDER BY c.created_at DESC LIMIT 50`,
      [req.user.id, req.user.id]
    );
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== CHALLENGE ROUTES ====================
app.get('/api/challenges', authMiddleware, async (req, res) => {
  try {
    const challenges = await allQuery('SELECT * FROM challenges ORDER BY target_value ASC');
    const userProgress = await allQuery('SELECT * FROM user_challenges WHERE user_id = ?', [req.user.id]);
    
    const challengesWithProgress = challenges.map(challenge => {
      const progress = userProgress.find(p => p.challenge_id === challenge.id);
      return {
        ...challenge,
        userProgress: progress || { current_progress: 0, status: 'not_started', score: 0 }
      };
    });
    
    res.json({ success: true, challenges: challengesWithProgress });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/challenges/daily', authMiddleware, async (req, res) => {
  try {
    const challenges = await allQuery('SELECT * FROM challenges WHERE is_daily = 1 OR category = "speaking" ORDER BY RANDOM() LIMIT 1');
    if (challenges.length === 0) {
      return res.status(404).json({ success: false, message: 'No challenges found' });
    }
    
    const dailyChallenge = challenges[0];
    const userProgress = await getQuery('SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ?', [req.user.id, dailyChallenge.id]);
    
    // Check if completed today
    const today = new Date().toISOString().split('T')[0];
    const isCompletedToday = userProgress && userProgress.status === 'completed' && 
      userProgress.completed_at && userProgress.completed_at.startsWith(today);
    
    res.json({ 
      success: true, 
      challenge: {
        ...dailyChallenge,
        userProgress: userProgress || { current_progress: 0, status: 'not_started' },
        isCompletedToday
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/challenges/:challengeId/start', authMiddleware, async (req, res) => {
  try {
    const { challengeId } = req.params;
    const challenge = await getQuery('SELECT * FROM challenges WHERE id = ?', [challengeId]);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }
    
    const existing = await getQuery('SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ?', [req.user.id, challengeId]);
    
    if (!existing) {
      await runQuery(
        'INSERT INTO user_challenges (id, user_id, challenge_id, status, started_at) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), req.user.id, challengeId, 'in_progress', new Date().toISOString()]
      );
    } else if (existing.status === 'not_started') {
      await runQuery(
        'UPDATE user_challenges SET status = ?, started_at = ? WHERE user_id = ? AND challenge_id = ?',
        ['in_progress', new Date().toISOString(), req.user.id, challengeId]
      );
    }
    
    res.json({ success: true, message: 'Challenge started!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/challenges/:challengeId/progress', authMiddleware, async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { currentProgress } = req.body;
    
    const challenge = await getQuery('SELECT * FROM challenges WHERE id = ?', [challengeId]);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }
    
    const isCompleted = currentProgress >= challenge.target_value;
    
    const existing = await getQuery('SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ?', [req.user.id, challengeId]);
    
    if (existing) {
      await runQuery(
        `UPDATE user_challenges SET current_progress = ?, status = ?, completed_at = ?, score = ? 
         WHERE user_id = ? AND challenge_id = ?`,
        [currentProgress, isCompleted ? 'completed' : 'in_progress', 
         isCompleted ? new Date().toISOString() : null,
         isCompleted ? challenge.points : existing.score,
         req.user.id, challengeId]
      );
      
      if (isCompleted && existing.status !== 'completed') {
        await runQuery('UPDATE users SET points = COALESCE(points, 0) + ?, streak = COALESCE(streak, 0) + 1 WHERE id = ?',
          [challenge.points, req.user.id]);
        
        // Create notification for completed challenge
        await runQuery(
          'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), req.user.id, 'Challenge Completed!', `You completed "${challenge.title}" and earned ${challenge.points} points!`, 'success']
        );
      }
    }
    
    res.json({ 
      success: true, 
      message: isCompleted ? '🎉 Challenge completed!' : 'Progress updated!',
      completed: isCompleted,
      pointsEarned: isCompleted ? challenge.points : 0
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/challenges/progress', authMiddleware, async (req, res) => {
  try {
    const completed = await allQuery(
      'SELECT * FROM user_challenges WHERE user_id = ? AND status = "completed"',
      [req.user.id]
    );
    
    const totalPoints = completed.reduce((sum, c) => sum + (c.score || 0), 0);
    const totalMinutes = completed.reduce((sum, c) => sum + (c.current_progress || 0), 0);
    
    // Calculate level based on points
    let level = 'Beginner';
    if (totalPoints >= 5000) level = 'Master';
    else if (totalPoints >= 2000) level = 'Expert';
    else if (totalPoints >= 1000) level = 'Advanced';
    else if (totalPoints >= 500) level = 'Intermediate';
    else if (totalPoints >= 100) level = 'Bronze';
    
    res.json({
      success: true,
      stats: {
        totalCompleted: completed.length,
        totalPoints: totalPoints,
        currentStreak: req.user.streak || 0,
        totalMinutes: totalMinutes,
        level: level,
        nextLevelPoints: level === 'Master' ? totalPoints : 
                         level === 'Expert' ? 5000 :
                         level === 'Advanced' ? 2000 :
                         level === 'Intermediate' ? 1000 :
                         level === 'Bronze' ? 500 : 100
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== NOTIFICATION ROUTES ====================
app.get('/api/notifications', authMiddleware, async (req, res) => {
  try {
    const notifications = await allQuery(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    await runQuery('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== AI TEACHER ROUTES ====================
const getAIResponse = (message, userName, conversationHistory = []) => {
  const msg = message.toLowerCase();
  
  // Greeting responses
  if (msg.match(/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)/)) {
    const greetings = [
      `Hello ${userName}! 👋 I'm your AI English teacher. How can I help you practice English today?`,
      `Hi ${userName}! 🌟 Ready to improve your English? Ask me about grammar, vocabulary, pronunciation, or just have a conversation!`,
      `Hey ${userName}! 👋 What would you like to learn today? I can help with speaking, writing, reading, or listening skills!`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  
  // Grammar help
  if (msg.includes('grammar') || msg.includes('tense')) {
    if (msg.includes('present')) {
      return `📚 **Present Simple Tense**\n\n**Usage**: Habits, facts, routines\n**Structure**: Subject + base verb (+s for he/she/it)\n\n**Examples**:\n✅ "I study English daily."\n✅ "She speaks fluently."\n✅ "They practice every day."\n✅ "The sun rises in the east."\n\n**Question**: "Do you study every day?"\n**Negative**: "I don't study on weekends."\n\nWould you like to practice making sentences?`;
    } else if (msg.includes('past')) {
      return `📚 **Past Simple Tense**\n\n**Usage**: Completed actions in the past\n**Structure**: Subject + past verb (regular: +ed / irregular forms)\n\n**Regular Examples**:\n✅ "Yesterday, I studied for an hour."\n✅ "She walked to school."\n✅ "They played football."\n\n**Irregular Examples**:\n✅ "I went to the store." (go → went)\n✅ "She ate dinner." (eat → ate)\n✅ "He saw a movie." (see → saw)\n✅ "They bought a car." (buy → bought)\n\n**Question**: "Did you study yesterday?"\n**Negative**: "I didn't study yesterday."\n\nTry making a past tense sentence!`;
    } else if (msg.includes('future')) {
      return `📚 **Future Tense**\n\n**Two common ways to express future:**\n\n**1. 'Will' for predictions & decisions**:\n✅ "I will help you tomorrow."\n✅ "She will call you later."\n✅ "It will rain today."\n✅ "I think it will be sunny."\n\n**2. 'Going to' for plans**:\n✅ "I am going to study tonight."\n✅ "We are going to travel next week."\n✅ "She is going to learn English."\n✅ "They are going to buy a house."\n\n**Question**: "Will you come to the party?" / "Are you going to study?"\n**Negative**: "I won't forget." / "I'm not going to be late."\n\nWhat will you do tomorrow?`;
    } else if (msg.includes('present perfect')) {
      return `📚 **Present Perfect Tense**\n\n**Usage**: Experiences, changes, unfinished time\n**Structure**: Subject + have/has + past participle\n\n**Examples**:\n✅ "I have visited Paris."\n✅ "She has worked here for 5 years."\n✅ "They have already eaten."\n✅ "Have you ever tried sushi?"\n\n**Key words**: ever, never, already, yet, just, for, since\n\nWould you like to practice making present perfect sentences?`;
    } else {
      return `📚 **Grammar Help**\n\nWhich tense would you like to practice?\n\n• **Present** - habits, facts, routines\n• **Past** - completed actions\n• **Future** - predictions, plans\n• **Present Perfect** - experiences, changes\n\nType "present grammar", "past grammar", "future grammar", or "present perfect grammar" to get started! 🌟\n\nOr ask me about specific grammar rules like:\n- Conditional sentences\n- Passive voice\n- Reported speech\n- Modal verbs`;
    }
  }
  
  // Vocabulary help
  if (msg.includes('vocabulary') || msg.includes('word') || msg.includes('meaning')) {
    const words = {
      'excellent': {
        meaning: 'Extremely good; outstanding',
        pronunciation: '/ˈek.sə.lənt/',
        examples: [
          '"Your English is excellent!"',
          '"She gave an excellent presentation."',
          '"That\'s an excellent idea!"',
          '"The food was excellent."'
        ],
        synonyms: 'outstanding, superb, fantastic, wonderful'
      },
      'challenge': {
        meaning: 'A difficult task that tests someone\'s abilities',
        pronunciation: '/ˈtʃæl.ɪndʒ/',
        examples: [
          '"Learning English is a fun challenge."',
          '"She accepted the challenge."',
          '"This challenge will help you improve."',
          '"He faced many challenges."'
        ],
        synonyms: 'difficulty, obstacle, test, trial'
      },
      'improve': {
        meaning: 'To become better at something',
        pronunciation: '/ɪmˈpruːv/',
        examples: [
          '"Practice every day to improve."',
          '"Your pronunciation is improving!"',
          '"This exercise will improve your grammar."',
          '"I want to improve my speaking skills."'
        ],
        synonyms: 'enhance, develop, refine, upgrade'
      },
      'fluent': {
        meaning: 'Able to speak a language easily and smoothly',
        pronunciation: '/ˈfluː.ənt/',
        examples: [
          '"She is fluent in English."',
          '"He speaks fluent Spanish."',
          '"I want to become fluent."',
          '"Fluent speakers don\'t translate in their heads."'
        ],
        synonyms: 'articulate, eloquent, smooth'
      },
      'practice': {
        meaning: 'To do something repeatedly to improve',
        pronunciation: '/ˈpræk.tɪs/',
        examples: [
          '"Practice makes perfect."',
          '"I practice English every day."',
          '"She practices pronunciation."',
          '"Regular practice is key to improvement."'
        ],
        synonyms: 'rehearse, train, exercise, drill'
      }
    };
    
    // Find which word the user is asking about
    let wordFound = null;
    for (const [word, data] of Object.entries(words)) {
      if (msg.includes(word)) {
        wordFound = { word, ...data };
        break;
      }
    }
    
    if (wordFound) {
      return `📖 **Vocabulary Builder: "${wordFound.word}"**\n\n**Meaning**: ${wordFound.meaning}\n**Pronunciation**: ${wordFound.pronunciation}\n**Synonyms**: ${wordFound.synonyms}\n\n**Examples**:\n${wordFound.examples.map(ex => `• ${ex}`).join('\n')}\n\nTry using "${wordFound.word}" in your own sentence now! 🎯`;
    } else {
      return `📖 **Vocabulary Practice**\n\nHere are some useful words to learn:\n\n**1. Excellent** /ˈek.sə.lənt/\nMeaning: Extremely good\nExample: "Your English is excellent!"\n\n**2. Challenge** /ˈtʃæl.ɪndʒ/\nMeaning: A difficult but rewarding task\nExample: "This challenge will help you grow."\n\n**3. Improve** /ɪmˈpruːv/\nMeaning: To get better\nExample: "Daily practice helps improve skills."\n\n**4. Fluent** /ˈfluː.ənt/\nMeaning: Able to speak smoothly\nExample: "She is fluent in English."\n\n**5. Practice** /ˈpræk.tɪs/\nMeaning: Repeated exercise to improve\nExample: "Practice makes perfect."\n\nWhich word would you like to learn more about? Type the word (excellent, challenge, improve, fluent, or practice) to see detailed explanations! 📚`;
    }
  }
  
  // Pronunciation help
  if (msg.includes('pronunciation') || msg.includes('sound') || msg.includes('accent')) {
    if (msg.includes('th')) {
      return `🎤 **Pronunciation Practice: The "th" Sound**\n\n**Unvoiced /θ/** (tongue between teeth, no vibration):\n• "Think" - "I think so."\n• "Thought" - "I thought about it."\n• "Through" - "Go through the door."\n• "Three" - "I have three books."\n• "Thank" - "Thank you very much."\n• "Thursday" - "See you on Thursday."\n\n**Voiced /ð/** (tongue between teeth, with vibration):\n• "The" - "The weather is nice."\n• "This" - "This is great."\n• "That" - "That is correct."\n• "They" - "They are coming."\n• "There" - "There it is."\n• "Mother" - "My mother is kind."\n\n**Practice sentence**: "I think three things through the door."\n"Mother and father are there with their brother."\n\nSay each word 3 times slowly! 🎯\n\nWould you like more pronunciation practice for other sounds?`;
    } else if (msg.includes('r') || msg.includes('l')) {
      return `🎤 **Pronunciation Practice: R vs L Sounds**\n\n**R Sound** (tongue doesn't touch roof):\n• "Right" - "That's right."\n• "Run" - "I run every day."\n• "Red" - "The red car."\n• "Really" - "Really good!"\n• "Rice" - "I eat rice."\n\n**L Sound** (tongue touches roof behind teeth):\n• "Light" - "Turn on the light."\n• "Long" - "A long road."\n• "Love" - "I love English."\n• "Little" - "A little bit."\n• "Live" - "I live here."\n\n**Minimal Pairs Practice**:\n• "Right" vs "Light"\n• "Red" vs "Led"\n• "Road" vs "Load"\n• "Rice" vs "Lice"\n• "Run" vs "Lung"\n\nSay each pair 5 times! 🔄`;
    } else {
      return `🎤 **Pronunciation Practice**\n\n**Common difficult sounds in English:**\n\n**1. The "th" sound** (/θ/ and /ð/):\nType "th pronunciation" for detailed practice\n\n**2. R vs L sounds**:\nType "r l pronunciation" for practice\n\n**3. Short vs Long vowels**:\n• "Ship" vs "Sheep"\n• "Live" vs "Leave"\n• "Full" vs "Fool"\n\n**4. Word Stress**:\n• "REcord" (noun) vs "reCORD" (verb)\n• "PREsent" (noun) vs "preSENT" (verb)\n\n**5. Silent letters**:\n• "Knife" (K is silent)\n• "Write" (W is silent)\n• "Hour" (H is silent)\n\nWhich sound would you like to practice? Type "th pronunciation", "r l pronunciation", "vowels", "word stress", or "silent letters"! 🎯`;
    }
  }
  
  // Speaking practice
  if (msg.includes('speaking') || msg.includes('conversation') || msg.includes('talk')) {
    const questions = [
      { q: "What is your favorite hobby and why do you enjoy it?", topic: "Hobbies" },
      { q: "How often do you practice English each week? What methods do you use?", topic: "Learning" },
      { q: "What is your ultimate goal for learning English? Where do you see yourself using it?", topic: "Goals" },
      { q: "Describe your best memory from last year in detail.", topic: "Memories" },
      { q: "What would you do if you had one million dollars? Be specific!", topic: "Imagination" },
      { q: "What's the best movie or book you've experienced recently? Why did you like it?", topic: "Entertainment" },
      { q: "Describe your dream vacation destination and what you would do there.", topic: "Travel" },
      { q: "What skill would you like to learn and why? How would you go about learning it?", topic: "Skills" },
      { q: "Tell me about a person who inspires you and why.", topic: "Inspiration" },
      { q: "What's your favorite food? Describe how to make it.", topic: "Food" },
      { q: "If you could travel back in time, what period would you visit and why?", topic: "Time Travel" },
      { q: "What's the best advice you've ever received?", topic: "Advice" },
      { q: "Describe your perfect day from morning to night.", topic: "Perfect Day" },
      { q: "What's something you're proud of accomplishing?", topic: "Achievements" },
      { q: "If you could have any superpower, what would it be and how would you use it?", topic: "Superpowers" }
    ];
    
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    
    return `🗣️ **Speaking Practice - Topic: ${randomQuestion.topic}**\n\nLet me ask you a question. Please answer in complete sentences with as much detail as possible:\n\n❓ **${randomQuestion.q}**\n\n**Tips for a great answer:**\n• Speak in full sentences\n• Give specific examples\n• Explain your reasons\n• Use descriptive words\n\nTake your time and give a detailed answer! I'll help correct your grammar and suggest better vocabulary. 🌟\n\nType your answer when you're ready!`;
  }
  
  // Writing practice
  if (msg.includes('writing') || msg.includes('essay') || msg.includes('paragraph')) {
    const topics = [
      { title: "Describe your daily routine", type: "Descriptive" },
      { title: "Your favorite place to relax", type: "Descriptive" },
      { title: "A person who inspires you", type: "Narrative" },
      { title: "Your plans for next weekend", type: "Future" },
      { title: "The best vacation you ever had", type: "Narrative" },
      { title: "Your opinion on online learning", type: "Opinion" },
      { title: "Describe your dream job", type: "Descriptive" },
      { title: "A childhood memory you cherish", type: "Narrative" }
    ];
    
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    
    return `✍️ **Writing Practice - ${randomTopic.type} Writing**\n\nTry writing a short paragraph (5-7 sentences) on this topic:\n\n📝 **Topic: ${randomTopic.title}**\n\n**Writing Tips:**\n• Start with a topic sentence\n• Use transition words (first, next, finally, however, therefore)\n• Include specific details and examples\n• End with a concluding sentence\n\n**Grammar to focus on:**\n• Use correct punctuation\n• Vary your sentence structure\n• Check subject-verb agreement\n\nWrite your paragraph, and I'll help with:\n• Grammar corrections 📝\n• Vocabulary suggestions 💡\n• Sentence structure improvements 🔧\n• Flow and coherence 🎯\n\nStart writing now! I'll review your paragraph and provide feedback.`;
  }
  
  // Reading comprehension
  if (msg.includes('reading') || msg.includes('comprehension')) {
    const passages = [
      {
        text: "Maria wakes up at 7 AM every day. She drinks coffee and reads the news before work. In the evening, she practices English for 30 minutes. Maria believes that consistent practice is the key to success. She has been learning English for two years and can now have fluent conversations. Her dream is to travel to an English-speaking country.",
        questions: [
          "What time does Maria wake up?",
          "What does she do before work?",
          "How long does she practice English?",
          "What does Maria believe?",
          "How long has Maria been learning English?",
          "What is Maria's dream?"
        ]
      },
      {
        text: "John is a software engineer who works from home. He starts his day at 8 AM with a morning jog. After breakfast, he checks his emails and plans his tasks. He takes a short break every hour to stretch. In the afternoon, he attends virtual meetings with his team. John enjoys the flexibility of working from home but misses social interactions with colleagues.",
        questions: [
          "What is John's profession?",
          "What time does he start his day?",
          "What does he do after breakfast?",
          "How often does he take breaks?",
          "What does he do in the afternoon?",
          "What does John miss about office work?"
        ]
      }
    ];
    
    const randomPassage = passages[Math.floor(Math.random() * passages.length)];
    
    return `📚 **Reading Comprehension**\n\nRead this paragraph carefully:\n\n---\n**"${randomPassage.text}"**\n---\n\n**Questions:**\n${randomPassage.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n**Instructions:**\n• Answer each question in a complete sentence\n• Use information directly from the text\n• Check your spelling and grammar\n\nAnswer these questions in complete sentences! I'll check your answers and provide feedback. 📖`;
  }
  
  // Thank you response
  if (msg.includes('thank')) {
    const thankResponses = [
      `You're very welcome, ${userName}! 🎉 It's my pleasure to help you learn English. Keep up the great work! 💪`,
      `Always happy to help, ${userName}! 🌟 Remember, consistent practice is the key. Is there anything else you'd like to learn today?`,
      `My pleasure, ${userName}! 🎯 You're making excellent progress. What shall we practice next?`
    ];
    return thankResponses[Math.floor(Math.random() * thankResponses.length)];
  }
  
  // Help menu
  if (msg.includes('help') || msg.includes('what can you do')) {
    return `🤖 **AI Teacher Help Menu**\n\nI can help you with:\n\n**📚 Grammar**\n• Type "present grammar", "past grammar", "future grammar", or "present perfect grammar"\n• Or ask specific grammar questions like "how to use conditionals"\n\n**📖 Vocabulary**\n• Type "vocabulary" to learn new words\n• Type a specific word like "excellent" or "challenge"\n\n**🎤 Pronunciation**\n• Type "pronunciation" for general practice\n• Type "th pronunciation" for the "th" sound\n• Type "r l pronunciation" for R vs L sounds\n\n**🗣️ Speaking Practice**\n• Type "speaking" or "conversation" for random questions\n\n**✍️ Writing**\n• Type "writing" for writing exercises\n\n**📚 Reading**\n• Type "reading" for comprehension practice\n\n**💬 Conversation**\n• Just talk to me naturally! I'll respond like a native speaker.\n\nWhat would you like to practice today? 🌟`;
  }
  
  // Default response for general conversation
  const defaultResponses = [
    `That's interesting, ${userName}! Tell me more about that. 🤔`,
    `I see! Can you elaborate on that? I'd love to hear more details. 💭`,
    `Great point! How does that relate to your English learning journey? 🎯`,
    `Thanks for sharing, ${userName}! What else would you like to discuss? 💬`,
    `That's a thoughtful observation. Keep going - you're doing great! 🌟`
  ];
  
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
};

app.post('/api/ai/chat', authMiddleware, async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message required' });
    }
    
    let conversation;
    let messages = [];
    
    if (conversationId) {
      conversation = await getQuery('SELECT * FROM ai_conversations WHERE id = ? AND user_id = ?', [conversationId, req.user.id]);
      if (conversation && conversation.messages) {
        messages = JSON.parse(conversation.messages);
      }
    }
    
    if (!conversation) {
      conversation = { id: uuidv4() };
    }
    
    messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
    const response = getAIResponse(message, req.user.name, messages);
    messages.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
    
    const messagesJson = JSON.stringify(messages);
    
    if (conversationId && conversation && conversation.id) {
      await runQuery(
        'UPDATE ai_conversations SET messages = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [messagesJson, conversation.id]
      );
    } else {
      await runQuery(
        'INSERT INTO ai_conversations (id, user_id, title, messages) VALUES (?, ?, ?, ?)',
        [conversation.id, req.user.id, message.substring(0, 50), messagesJson]
      );
    }
    
    res.json({ success: true, response, conversationId: conversation.id });
  } catch (error) {
    console.error('AI error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/ai/conversations', authMiddleware, async (req, res) => {
  try {
    const conversations = await allQuery(
      'SELECT id, title, created_at, updated_at FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC',
      [req.user.id]
    );
    res.json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/ai/conversations/:id', authMiddleware, async (req, res) => {
  try {
    const conversation = await getQuery('SELECT * FROM ai_conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    
    const messages = conversation.messages ? JSON.parse(conversation.messages) : [];
    res.json({ success: true, conversation: { ...conversation, messages } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/ai/conversations/:id', authMiddleware, async (req, res) => {
  try {
    await runQuery('DELETE FROM ai_conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== STATS ROUTES ====================
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const completedChallenges = await allQuery('SELECT * FROM user_challenges WHERE user_id = ? AND status = "completed"', [req.user.id]);
    const totalMessages = await getQuery('SELECT COUNT(*) as count FROM messages WHERE sender_id = ? OR receiver_id = ?', [req.user.id, req.user.id]);
    const callHistory = await allQuery('SELECT COUNT(*) as count, SUM(duration) as total_duration FROM call_history WHERE caller_id = ? OR receiver_id = ?', [req.user.id, req.user.id]);
    
    // Calculate level
    let level = 'Beginner';
    const totalPoints = req.user.points || 0;
    if (totalPoints >= 5000) level = 'Master';
    else if (totalPoints >= 2000) level = 'Expert';
    else if (totalPoints >= 1000) level = 'Advanced';
    else if (totalPoints >= 500) level = 'Intermediate';
    else if (totalPoints >= 100) level = 'Bronze';
    
    res.json({
      success: true,
      stats: {
        totalCalls: req.user.total_calls || 0,
        totalMessages: totalMessages?.count || 0,
        totalChallengesCompleted: completedChallenges.length,
        totalPoints: totalPoints,
        currentStreak: req.user.streak || 0,
        level: level,
        totalCallDuration: callHistory[0]?.total_duration || 0,
        memberSince: req.user.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== SOCKET.IO EVENTS ====================
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  let currentUserId = null;
  let currentUser = null;

  // ========== USER CONNECTION ==========
  socket.on('user_connected', async (data) => {
    const { userId, userName, userAvatar } = data;
    currentUserId = userId;
    currentUser = { userId, userName, userAvatar };
    
    console.log(`✅ User online: ${userName} (${userId})`);
    
    onlineUsers.set(userId, { socketId: socket.id, userName, userAvatar, userId });
    await runQuery('UPDATE users SET is_online = 1, last_active = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
    
    const onlineList = Array.from(onlineUsers.values()).map(u => ({
      userId: u.userId,
      userName: u.userName,
      userAvatar: u.userAvatar
    }));
    io.emit('online_users', onlineList);
    io.emit('user_connected_broadcast', { userId, userName });
  });

  // ========== RANDOM CHAT MATCHMAKING ==========
  socket.on('join_chat_queue', (data) => {
    const { userId, userName, userAvatar } = data;
    
    console.log(`💬 ${userName} joined chat queue. Queue size: ${chatQueue.length}`);
    
    // Remove user from queue if already there
    chatQueue = chatQueue.filter(u => u.userId !== userId);
    chatQueue.push({ userId, userName, userAvatar, socketId: socket.id, joinedAt: Date.now() });
    
    // Check for match
    if (chatQueue.length >= 2) {
      const user1 = chatQueue.shift();
      const user2 = chatQueue.shift();
      
      const chatId = `chat_${Date.now()}_${user1.userId}_${user2.userId}`;
      
      activeChats.set(chatId, {
        user1: user1.userId,
        user2: user2.userId,
        userName1: user1.userName,
        userName2: user2.userName,
        userAvatar1: user1.userAvatar,
        userAvatar2: user2.userAvatar,
        socket1: user1.socketId,
        socket2: user2.socketId,
        startedAt: Date.now()
      });
      
      console.log(`🎉 CHAT MATCH FOUND: ${user1.userName} <-> ${user2.userName} (${chatId})`);
      
      // Notify both users
      io.to(user1.socketId).emit('chat_match_found', {
        partnerId: user2.userId,
        partnerName: user2.userName,
        partnerAvatar: user2.userAvatar,
        chatId,
        type: 'chat'
      });
      
      io.to(user2.socketId).emit('chat_match_found', {
        partnerId: user1.userId,
        partnerName: user1.userName,
        partnerAvatar: user1.userAvatar,
        chatId,
        type: 'chat'
      });
    } else {
      socket.emit('waiting_for_partner', { 
        type: 'chat', 
        message: 'Looking for a chat partner...',
        queuePosition: chatQueue.length
      });
    }
  });

  // ========== RANDOM CALL MATCHMAKING ==========
  socket.on('join_call_queue', (data) => {
    const { userId, userName, userAvatar } = data;
    
    console.log(`📞 ${userName} joined call queue. Queue size: ${callQueue.length}`);
    
    // Remove user from queue if already there
    callQueue = callQueue.filter(u => u.userId !== userId);
    callQueue.push({ userId, userName, userAvatar, socketId: socket.id, joinedAt: Date.now() });
    
    // Check for match
    if (callQueue.length >= 2) {
      const user1 = callQueue.shift();
      const user2 = callQueue.shift();
      
      const callId = `call_${Date.now()}_${user1.userId}_${user2.userId}`;
      
      activeCalls.set(callId, {
        callerId: user1.userId,
        receiverId: user2.userId,
        callerName: user1.userName,
        receiverName: user2.userName,
        callerAvatar: user1.userAvatar,
        receiverAvatar: user2.userAvatar,
        callerSocket: user1.socketId,
        receiverSocket: user2.socketId,
        status: 'connecting',
        startedAt: Date.now()
      });
      
      console.log(`🎉 CALL MATCH FOUND: ${user1.userName} <-> ${user2.userName} (${callId})`);
      
      // Update call counts
      runQuery('UPDATE users SET total_calls = total_calls + 1 WHERE id = ?', [user1.userId]);
      runQuery('UPDATE users SET total_calls = total_calls + 1 WHERE id = ?', [user2.userId]);
      
      // Notify both users
      io.to(user1.socketId).emit('call_match_found', {
        callId: callId,
        partnerId: user2.userId,
        partnerName: user2.userName,
        partnerAvatar: user2.userAvatar,
        type: 'call',
        isInitiator: true
      });
      
      io.to(user2.socketId).emit('call_match_found', {
        callId: callId,
        partnerId: user1.userId,
        partnerName: user1.userName,
        partnerAvatar: user1.userAvatar,
        type: 'call',
        isInitiator: false
      });
    } else {
      socket.emit('waiting_for_partner', { 
        type: 'call', 
        message: 'Looking for a call partner...',
        queuePosition: callQueue.length
      });
    }
  });

  // ========== CANCEL QUEUE ==========
  socket.on('cancel_queue', ({ userId, type }) => {
    if (type === 'chat') {
      const before = chatQueue.length;
      chatQueue = chatQueue.filter(u => u.userId !== userId);
      console.log(`❌ User ${userId} left CHAT queue. Before: ${before}, After: ${chatQueue.length}`);
    } else if (type === 'call') {
      const before = callQueue.length;
      callQueue = callQueue.filter(u => u.userId !== userId);
      console.log(`❌ User ${userId} left CALL queue. Before: ${before}, After: ${callQueue.length}`);
    }
    socket.emit('queue_cancelled', { type });
  });

  // ========== SEND CHAT MESSAGE ==========
  socket.on('send_message', async (data) => {
    const { message, receiverId, senderId, senderName, senderAvatar, timestamp, chatId } = data;
    
    console.log(`💬 Message from ${senderName} to ${receiverId}: ${message.substring(0, 50)}`);
    
    const messageId = uuidv4();
    await runQuery(
      'INSERT INTO messages (id, sender_id, receiver_id, content, is_delivered, delivered_at) VALUES (?, ?, ?, ?, ?, ?)',
      [messageId, senderId, receiverId, message, 1, new Date().toISOString()]
    );
    
    await runQuery('UPDATE users SET total_messages = total_messages + 1 WHERE id = ?', [senderId]);
    
    const receiver = onlineUsers.get(receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit('new_message', {
        id: messageId,
        message,
        senderId,
        senderName,
        senderAvatar,
        timestamp: timestamp || new Date().toISOString(),
        chatId
      });
    }
    
    socket.emit('message_sent', { 
      id: messageId, 
      message, 
      timestamp: timestamp || new Date().toISOString(),
      chatId
    });
  });

  // ========== MARK MESSAGE AS READ ==========
  socket.on('mark_read', async ({ senderId, receiverId }) => {
    await runQuery(
      'UPDATE messages SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
      [senderId, receiverId]
    );
    
    const sender = onlineUsers.get(senderId);
    if (sender) {
      io.to(sender.socketId).emit('messages_read', { byUser: receiverId });
    }
  });

  // ========== TYPING INDICATORS ==========
  socket.on('typing_start', ({ receiverId, senderId, senderName, chatId }) => {
    const receiver = onlineUsers.get(receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit('user_typing', { 
        userId: senderId, 
        userName: senderName,
        chatId 
      });
    }
  });

  socket.on('typing_stop', ({ receiverId, senderId, chatId }) => {
    const receiver = onlineUsers.get(receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit('user_stop_typing', { 
        userId: senderId,
        chatId 
      });
    }
  });

  // ========== END CHAT ==========
  socket.on('end_chat', ({ partnerId, chatId, userId, userName }) => {
    console.log(`🔚 Chat ended by ${userName} (${userId}) - Chat ID: ${chatId}`);
    
    const partner = onlineUsers.get(partnerId);
    if (partner) {
      io.to(partner.socketId).emit('chat_ended', { 
        chatId, 
        endedBy: userId, 
        endedByName: userName 
      });
    }
    
    if (activeChats.has(chatId)) {
      activeChats.delete(chatId);
    }
    
    socket.emit('chat_ended', { chatId });
  });

  // ========== DIRECT CALL SIGNALING ==========
  
  // Initiate call (direct call to specific user)
  socket.on('initiate_call', async (data) => {
    const { receiverId, callType, callerId, callerName, callerAvatar } = data;
    
    console.log(`📞 Call initiated: ${callerName} -> ${receiverId} (${callType})`);
    
    const caller = onlineUsers.get(callerId);
    const receiver = onlineUsers.get(receiverId);
    
    if (!caller || !receiver) {
      socket.emit('call_error', { message: 'User not online' });
      return;
    }
    
    const callId = uuidv4();
    
    activeCalls.set(callId, {
      callerId,
      receiverId,
      callerName,
      receiverName: receiver.userName,
      callerAvatar,
      receiverAvatar: receiver.userAvatar,
      callerSocket: caller.socketId,
      receiverSocket: receiver.socketId,
      callType,
      status: 'ringing',
      startedAt: Date.now()
    });
    
    // Save to call history
    await runQuery(
      'INSERT INTO call_history (id, caller_id, receiver_id, call_type, status, started_at) VALUES (?, ?, ?, ?, ?, ?)',
      [callId, callerId, receiverId, callType, 'initiated', new Date().toISOString()]
    );
    
    io.to(receiver.socketId).emit('incoming_call', {
      callId,
      callerId,
      callerName,
      callerAvatar,
      callType
    });
  });
  
  // Accept call
  socket.on('accept_call', async (data) => {
    const { callId, callerId, receiverId, receiverName, receiverAvatar } = data;
    
    console.log(`✅ Call accepted: ${callId} by ${receiverName}`);
    
    const call = activeCalls.get(callId);
    if (call) {
      call.status = 'connected';
      activeCalls.set(callId, call);
      
      // Update call history
      await runQuery(
        'UPDATE call_history SET status = "accepted" WHERE id = ?',
        [callId]
      );
    }
    
    const caller = onlineUsers.get(callerId);
    if (caller) {
      io.to(caller.socketId).emit('call_accepted', {
        callId,
        receiverId,
        receiverName,
        receiverAvatar
      });
    }
  });
  
  // Reject call
  socket.on('reject_call', async (data) => {
    const { callId, callerId, receiverName } = data;
    
    console.log(`❌ Call rejected: ${callId} by ${receiverName}`);
    
    const caller = onlineUsers.get(callerId);
    if (caller) {
      io.to(caller.socketId).emit('call_rejected', { callId });
    }
    
    // Update call history
    await runQuery(
      'UPDATE call_history SET status = "rejected", ended_at = CURRENT_TIMESTAMP WHERE id = ?',
      [callId]
    );
    
    if (activeCalls.has(callId)) {
      activeCalls.delete(callId);
    }
  });
  
  // ========== WEBRTC SIGNALING ==========
  socket.on('offer', ({ to, offer, callId }) => {
    const target = onlineUsers.get(to);
    if (target) {
      io.to(target.socketId).emit('offer', { 
        from: currentUserId, 
        offer,
        callId 
      });
    }
  });

  socket.on('answer', ({ to, answer, callId }) => {
    const target = onlineUsers.get(to);
    if (target) {
      io.to(target.socketId).emit('answer', { 
        from: currentUserId, 
        answer,
        callId 
      });
    }
  });

  socket.on('ice-candidate', ({ to, candidate, callId }) => {
    const target = onlineUsers.get(to);
    if (target) {
      io.to(target.socketId).emit('ice-candidate', { 
        from: currentUserId, 
        candidate,
        callId 
      });
    }
  });

  // ========== CALL CONTROLS (Mute/Video/End) ==========
  socket.on('toggle_mic', ({ to, isMuted, callId }) => {
    const target = onlineUsers.get(to);
    if (target) {
      io.to(target.socketId).emit('partner_toggled_mic', { isMuted, callId });
    }
  });

  socket.on('toggle_video', ({ to, isVideoOff, callId }) => {
    const target = onlineUsers.get(to);
    if (target) {
      io.to(target.socketId).emit('partner_toggled_video', { isVideoOff, callId });
    }
  });

  // ========== END CALL ==========
  socket.on('end_call', async ({ to, callId, userId, userName }) => {
    console.log(`📞 Call ended: ${callId} by ${userName}`);
    
    const target = onlineUsers.get(to);
    if (target) {
      io.to(target.socketId).emit('call_ended', { callId });
    }
    
    // Update call history with duration
    const call = activeCalls.get(callId);
    if (call) {
      const duration = Math.floor((Date.now() - call.startedAt) / 1000);
      await runQuery(
        'UPDATE call_history SET status = "ended", duration = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?',
        [duration, callId]
      );
    }
    
    if (activeCalls.has(callId)) {
      activeCalls.delete(callId);
    }
    
    socket.emit('call_ended', { callId });
  });

  // ========== DISCONNECT HANDLER ==========
  socket.on('disconnect', async () => {
    console.log('🔌 Client disconnected:', socket.id);
    
    if (currentUserId) {
      // Remove from online users
      onlineUsers.delete(currentUserId);
      await runQuery('UPDATE users SET is_online = 0 WHERE id = ?', [currentUserId]);
      
      // Remove from queues
      const beforeChat = chatQueue.length;
      const beforeCall = callQueue.length;
      chatQueue = chatQueue.filter(u => u.userId !== currentUserId);
      callQueue = callQueue.filter(u => u.userId !== currentUserId);
      
      if (beforeChat !== chatQueue.length || beforeCall !== callQueue.length) {
        console.log(`Removed from queues - Chat: ${beforeChat}->${chatQueue.length}, Call: ${beforeCall}->${callQueue.length}`);
      }
      
      // Notify active chat partner if in a chat
      for (const [chatId, chat] of activeChats) {
        if (chat.user1 === currentUserId || chat.user2 === currentUserId) {
          const partnerId = chat.user1 === currentUserId ? chat.user2 : chat.user1;
          const partner = onlineUsers.get(partnerId);
          
          if (partner) {
            io.to(partner.socketId).emit('partner_disconnected', {
              partnerId: currentUserId,
              partnerName: currentUser?.userName || 'Partner',
              chatId
            });
          }
          
          activeChats.delete(chatId);
          console.log(`Removed active chat ${chatId} due to disconnect`);
          break;
        }
      }
      
      // Notify active call partner if in a call
      for (const [callId, call] of activeCalls) {
        if (call.callerId === currentUserId || call.receiverId === currentUserId) {
          const partnerId = call.callerId === currentUserId ? call.receiverId : call.callerId;
          const partner = onlineUsers.get(partnerId);
          
          if (partner) {
            io.to(partner.socketId).emit('call_ended', { 
              callId,
              reason: 'partner_disconnected'
            });
          }
          
          // Update call history
          await runQuery(
            'UPDATE call_history SET status = "disconnected", ended_at = CURRENT_TIMESTAMP WHERE id = ?',
            [callId]
          );
          
          activeCalls.delete(callId);
          console.log(`Removed active call ${callId} due to disconnect`);
          break;
        }
      }
      
      // Broadcast updated online users list
      const onlineList = Array.from(onlineUsers.values()).map(u => ({
        userId: u.userId,
        userName: u.userName,
        userAvatar: u.userAvatar
      }));
      io.emit('online_users', onlineList);
      io.emit('user_disconnected', { userId: currentUserId });
      
      console.log(`👋 User ${currentUserId} (${currentUser?.userName}) disconnected`);
    }
  });
});

// ==================== HEALTH CHECK ====================
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: '✅ API is working!', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    onlineUsers: onlineUsers.size,
    chatQueue: chatQueue.length,
    callQueue: callQueue.length,
    activeChats: activeChats.size,
    activeCalls: activeCalls.size
  });
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} not found` });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 EasyTalk Backend Server - FULLY WORKING');
  console.log('='.repeat(80));
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: Active and ready`);
  console.log(`🗄️  Database: SQLite (easytalk.db)`);
  console.log('\n' + '='.repeat(80));
  console.log('📋 FEATURES IMPLEMENTED:');
  console.log('='.repeat(80));
  console.log('\n🔐 AUTHENTICATION:');
  console.log('   ✅ User Registration with validation');
  console.log('   ✅ User Login with JWT');
  console.log('   ✅ Token Refresh');
  console.log('   ✅ Profile Management');
  console.log('\n💬 CHAT SYSTEM:');
  console.log('   ✅ Random Chat Matchmaking');
  console.log('   ✅ Real-time Messaging');
  console.log('   ✅ Typing Indicators');
  console.log('   ✅ Message Read Receipts');
  console.log('   ✅ Chat History');
  console.log('\n📞 CALL SYSTEM:');
  console.log('   ✅ Random Call Matchmaking');
  console.log('   ✅ Direct User Calls');
  console.log('   ✅ WebRTC Video/Audio Calls');
  console.log('   ✅ Mute/Unmute Button');
  console.log('   ✅ Video On/Off Button');
  console.log('   ✅ End Call Button');
  console.log('   ✅ Call History Tracking');
  console.log('\n🎯 CHALLENGES:');
  console.log('   ✅ 6 Speaking Challenges (20/45/90 mins)');
  console.log('   ✅ Daily Challenge');
  console.log('   ✅ Progress Tracking');
  console.log('   ✅ Points & Streaks System');
  console.log('   ✅ Level System (Beginner to Master)');
  console.log('\n🤖 AI TEACHER:');
  console.log('   ✅ Grammar Lessons');
  console.log('   ✅ Vocabulary Builder');
  console.log('   ✅ Pronunciation Practice');
  console.log('   ✅ Speaking Practice');
  console.log('   ✅ Writing Exercises');
  console.log('   ✅ Reading Comprehension');
  console.log('   ✅ Conversation Practice');
  console.log('\n👥 SOCIAL:');
  console.log('   ✅ Online/Offline Status');
  console.log('   ✅ Friend Requests');
  console.log('   ✅ Notifications');
  console.log('   ✅ User Profiles');
  console.log('\n📊 STATISTICS:');
  console.log('   ✅ Total Calls/Messages');
  console.log('   ✅ Challenge Completion');
  console.log('   ✅ Points & Streaks');
  console.log('   ✅ Level Progression');
  console.log('='.repeat(80));
  console.log('\n✨ Server is ready! Waiting for connections...\n');
});

module.exports = { app, server, io };
