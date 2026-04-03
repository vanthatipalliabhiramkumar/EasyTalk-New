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
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Database setup
const dbPath = path.join(__dirname, 'easytalk.db');

if (fs.existsSync(dbPath)) {
  console.log('🗑️  Deleting old database...');
  fs.unlinkSync(dbPath);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database error:', err);
  } else {
    console.log('✅ SQLite database created');
  }
});

// Create tables
db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS user_challenges`);
  db.run(`DROP TABLE IF EXISTS ai_conversations`);
  db.run(`DROP TABLE IF EXISTS messages`);
  db.run(`DROP TABLE IF EXISTS challenges`);
  db.run(`DROP TABLE IF EXISTS users`);
  
  db.run(`
    CREATE TABLE users (
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    )
  `);
  
  db.run(`
    CREATE TABLE challenges (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      points INTEGER DEFAULT 50,
      difficulty TEXT DEFAULT 'beginner',
      prompt TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE user_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      challenge_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      response TEXT,
      score INTEGER DEFAULT 0,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id)
    )
  `);
  
  db.run(`
    CREATE TABLE ai_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      messages TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  console.log('✅ Database tables created');
});

// Helper functions
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

const JWT_SECRET = 'your-super-secret-key-2024';

// Store online users and queues
const onlineUsers = new Map();
let chatQueue = [];
let callQueue = [];
let activeChats = new Map(); // Track active chats for disconnect handling

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
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    
    const existingUser = await getQuery('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff&size=100`;
    
    await runQuery(
      'INSERT INTO users (id, name, email, password, gender, avatar) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, name, email.toLowerCase(), hashedPassword, gender || 'Other', avatar]
    );
    
    const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '30d' });
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        name: name,
        email: email.toLowerCase(),
        avatar: avatar,
        streak: 0,
        totalCalls: 0,
        totalMessages: 0
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
    
    const user = await getQuery('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        streak: user.streak || 0,
        totalCalls: user.total_calls || 0,
        totalMessages: user.total_messages || 0
      }
    });
  } catch (error) {
    console.error('Login error:', error);
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
      totalMessages: req.user.total_messages || 0
    }
  });
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  await runQuery('UPDATE users SET is_online = 0 WHERE id = ?', [req.user.id]);
  res.json({ success: true });
});

// ==================== USER ROUTES ====================
app.get('/api/users', authMiddleware, async (req, res) => {
  const users = await allQuery('SELECT id, name, email, avatar, is_online FROM users WHERE id != ?', [req.user.id]);
  res.json({ success: true, users });
});

app.get('/api/users/online', authMiddleware, (req, res) => {
  const online = Array.from(onlineUsers.values()).map(u => ({ id: u.userId, name: u.userName, avatar: u.userAvatar }));
  res.json({ success: true, count: online.length, users: online });
});

app.get('/api/users/:id', authMiddleware, async (req, res) => {
  const user = await getQuery('SELECT id, name, avatar, is_online FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ success: false });
  res.json({ success: true, user });
});

// ==================== CHAT ROUTES ====================
app.post('/api/chat/send', authMiddleware, async (req, res) => {
  const { receiverId, content } = req.body;
  const messageId = uuidv4();
  
  await runQuery(
    'INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)',
    [messageId, req.user.id, receiverId, content]
  );
  
  await runQuery('UPDATE users SET total_messages = total_messages + 1 WHERE id = ?', [req.user.id]);
  
  res.status(201).json({
    success: true,
    message: {
      id: messageId,
      sender: req.user.id,
      receiver: receiverId,
      content,
      createdAt: new Date().toISOString(),
      senderDetails: { id: req.user.id, name: req.user.name, avatar: req.user.avatar }
    }
  });
});

app.get('/api/chat/:userId', authMiddleware, async (req, res) => {
  const messages = await allQuery(
    `SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY created_at ASC`,
    [req.user.id, req.params.userId, req.params.userId, req.user.id]
  );
  res.json({ success: true, messages });
});

app.get('/api/chat/recent', authMiddleware, async (req, res) => {
  const messages = await allQuery(
    `SELECT m.*, u.name, u.avatar FROM messages m 
     JOIN users u ON (m.sender_id = u.id OR m.receiver_id = u.id) 
     WHERE (m.sender_id = ? OR m.receiver_id = ?) AND u.id != ?
     ORDER BY m.created_at DESC LIMIT 50`,
    [req.user.id, req.user.id, req.user.id]
  );
  
  const chatMap = new Map();
  messages.forEach(m => {
    const otherId = m.sender_id === req.user.id ? m.receiver_id : m.sender_id;
    if (!chatMap.has(otherId)) {
      chatMap.set(otherId, {
        userId: otherId,
        name: m.name,
        avatar: m.avatar,
        lastMessage: m.content,
        lastMessageTime: m.created_at,
        isOnline: onlineUsers.has(otherId)
      });
    }
  });
  
  res.json({ success: true, chats: Array.from(chatMap.values()) });
});

// ==================== CHALLENGE ROUTES ====================
app.get('/api/challenges', authMiddleware, async (req, res) => {
  const challenges = await allQuery('SELECT * FROM challenges');
  res.json({ success: true, challenges });
});

app.get('/api/challenges/daily', authMiddleware, async (req, res) => {
  const challenge = await getQuery('SELECT * FROM challenges ORDER BY RANDOM() LIMIT 1');
  res.json({ success: true, challenge: { ...challenge, completed: false } });
});

app.post('/api/challenges/:challengeId/start', authMiddleware, async (req, res) => {
  const id = uuidv4();
  await runQuery(
    'INSERT INTO user_challenges (id, user_id, challenge_id, status) VALUES (?, ?, ?, "in-progress")',
    [id, req.user.id, req.params.challengeId]
  );
  res.json({ success: true });
});

app.post('/api/challenges/:challengeId/submit', authMiddleware, async (req, res) => {
  const { response } = req.body;
  
  const userChallenge = await getQuery(
    'SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ? AND status = "in-progress"',
    [req.user.id, req.params.challengeId]
  );
  
  if (!userChallenge) {
    return res.status(400).json({ success: false, message: 'Challenge not started' });
  }
  
  let score = response?.length > 50 ? 85 : response?.length > 20 ? 70 : 50;
  let feedback = score >= 85 ? 'Excellent! Great job!' : score >= 70 ? 'Good work!' : 'Good start! Try adding more details.';
  
  await runQuery(
    'UPDATE user_challenges SET status = "completed", score = ?, response = ?, feedback = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
    [score, response, feedback, userChallenge.id]
  );
  
  await runQuery('UPDATE users SET streak = streak + 1 WHERE id = ?', [req.user.id]);
  
  res.json({ success: true, score, feedback });
});

app.get('/api/challenges/progress', authMiddleware, async (req, res) => {
  const completed = await getQuery(
    'SELECT COUNT(*) as count, SUM(score) as total FROM user_challenges WHERE user_id = ? AND status = "completed"',
    [req.user.id]
  );
  
  res.json({
    success: true,
    stats: {
      totalCompleted: completed.count || 0,
      totalPoints: completed.total || 0,
      currentStreak: req.user.streak || 0
    }
  });
});

// ==================== AI TEACHER ROUTES ====================
function getAIResponse(message, userName) {
  const msg = message.toLowerCase();
  
  if (msg.match(/^(hi|hello|hey)/)) {
    return `Hello ${userName}! 👋 I'm your AI English teacher. How can I help you practice English today?`;
  }
  if (msg.includes('grammar')) {
    return `📚 **Grammar Lesson**\n\n**Present Simple**: "I study English daily."\n**Past Simple**: "Yesterday, I studied for an hour."\n**Future**: "I will practice tomorrow."\n\nWhich tense would you like to practice?`;
  }
  if (msg.includes('vocabulary')) {
    return `📖 **Vocabulary Builder**\n\n**Word**: "Excellent"\n**Meaning**: Extremely good\n**Example**: "Your English is excellent!"\n\nTry using this word in a sentence!`;
  }
  if (msg.includes('pronunciation')) {
    return `🎤 **Pronunciation Practice**\n\nPractice the 'th' sound:\n- "The weather is wonderful today."\n- "Think, thought, through"\n\nSay this 3 times fast!`;
  }
  if (msg.includes('speaking') || msg.includes('conversation')) {
    return `🗣️ **Speaking Practice**\n\nTell me about your favorite hobby. Why do you enjoy it? How often do you do it?\n\nTake your time and give detailed answers!`;
  }
  
  return `Great question, ${userName}! What would you like to practice? Grammar, vocabulary, pronunciation, or conversation? I'm here to help! 🌟`;
}

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
      if (conversation) {
        messages = JSON.parse(conversation.messages || '[]');
      }
    }
    
    if (!conversation) {
      conversation = { id: uuidv4() };
    }
    
    messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
    const response = getAIResponse(message, req.user.name);
    messages.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
    
    if (conversationId) {
      await runQuery(
        'UPDATE ai_conversations SET messages = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [JSON.stringify(messages), conversation.id]
      );
    } else {
      await runQuery(
        'INSERT INTO ai_conversations (id, user_id, title, messages) VALUES (?, ?, ?, ?)',
        [conversation.id, req.user.id, message.substring(0, 50), JSON.stringify(messages)]
      );
    }
    
    res.json({ success: true, response, conversationId: conversation.id });
  } catch (error) {
    console.error('AI error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/ai/conversations', authMiddleware, async (req, res) => {
  const conversations = await allQuery(
    'SELECT id, title, created_at, updated_at FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC',
    [req.user.id]
  );
  res.json({ success: true, conversations });
});

app.delete('/api/ai/conversations/:id', authMiddleware, async (req, res) => {
  await runQuery('DELETE FROM ai_conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// ==================== SOCKET.IO MATCHMAKING ====================
io.on('connection', (socket) => {
  console.log('🔌 New client connected. Socket ID:', socket.id);

  socket.on('user_connected', async (data) => {
    const { userId, userName, userAvatar } = data;
    console.log(`📡 User connected: ${userName} (${userId}) with socket ${socket.id}`);
    
    onlineUsers.set(userId, { socketId: socket.id, userName, userAvatar, userId });
    await runQuery('UPDATE users SET is_online = 1 WHERE id = ?', [userId]);
    
    console.log(`✅ ${userName} is now online. Total online: ${onlineUsers.size}`);
    
    const onlineList = Array.from(onlineUsers.values()).map(u => ({
      userId: u.userId,
      userName: u.userName,
      userAvatar: u.userAvatar
    }));
    io.emit('online_users', onlineList);
  });

  // CHAT MATCHMAKING
  socket.on('join_chat_queue', (data) => {
    const { userId, userName, userAvatar } = data;
    
    console.log(`💬 CHAT QUEUE: ${userName} (${userId}) joined. Queue size before: ${chatQueue.length}`);
    
    chatQueue = chatQueue.filter(u => u.userId !== userId);
    chatQueue.push({ userId, userName, userAvatar, socketId: socket.id, joinedAt: Date.now() });
    
    if (chatQueue.length >= 2) {
      const user1 = chatQueue[0];
      const user2 = chatQueue[1];
      chatQueue = chatQueue.filter(u => u.userId !== user1.userId && u.userId !== user2.userId);
      
      // Track active chat
      const chatId = `chat_${Date.now()}_${user1.userId}_${user2.userId}`;
      activeChats.set(chatId, {
        user1: user1.userId,
        user2: user2.userId,
        userName1: user1.userName,
        userName2: user2.userName,
        socket1: user1.socketId,
        socket2: user2.socketId
      });
      
      console.log(`🎉 CHAT MATCH: ${user1.userName} <-> ${user2.userName} (Chat ID: ${chatId})`);
      
      io.to(user1.socketId).emit('chat_match_found', {
        partnerId: user2.userId,
        partnerName: user2.userName,
        partnerAvatar: user2.userAvatar,
        type: 'chat'
      });
      
      io.to(user2.socketId).emit('chat_match_found', {
        partnerId: user1.userId,
        partnerName: user1.userName,
        partnerAvatar: user1.userAvatar,
        type: 'chat'
      });
    } else {
      socket.emit('waiting_for_partner', { type: 'chat', message: 'Looking for a chat partner...' });
    }
  });

  // CALL MATCHMAKING
  socket.on('join_call_queue', (data) => {
    const { userId, userName, userAvatar } = data;
    
    console.log(`📞 CALL QUEUE: ${userName} (${userId}) joined. Queue size before: ${callQueue.length}`);
    
    callQueue = callQueue.filter(u => u.userId !== userId);
    callQueue.push({ userId, userName, userAvatar, socketId: socket.id, joinedAt: Date.now() });
    
    if (callQueue.length >= 2) {
      const user1 = callQueue[0];
      const user2 = callQueue[1];
      callQueue = callQueue.filter(u => u.userId !== user1.userId && u.userId !== user2.userId);
      
      console.log(`🎉 CALL MATCH: ${user1.userName} <-> ${user2.userName}`);
      
      io.to(user1.socketId).emit('call_match_found', {
        partnerId: user2.userId,
        partnerName: user2.userName,
        partnerAvatar: user2.userAvatar,
        type: 'call'
      });
      
      io.to(user2.socketId).emit('call_match_found', {
        partnerId: user1.userId,
        partnerName: user1.userName,
        partnerAvatar: user1.userAvatar,
        type: 'call'
      });
    } else {
      socket.emit('waiting_for_partner', { type: 'call', message: 'Looking for a call partner...' });
    }
  });

  // CANCEL QUEUE
  socket.on('cancel_queue', (data) => {
    const { userId, type } = data;
    
    if (type === 'chat') {
      chatQueue = chatQueue.filter(u => u.userId !== userId);
      console.log(`❌ User ${userId} left CHAT queue`);
    } else if (type === 'call') {
      callQueue = callQueue.filter(u => u.userId !== userId);
      console.log(`❌ User ${userId} left CALL queue`);
    }
    socket.emit('queue_cancelled', { type });
  });

  // END CHAT EVENT - Notifies BOTH users to go to homepage
  socket.on('end_chat', (data) => {
    const { chatId, userId, userName, partnerId } = data;
    console.log(`🔚 Chat ended by ${userName} (${userId})`);
    
    // Notify the partner that chat has ended
    const partner = onlineUsers.get(partnerId);
    if (partner) {
      console.log(`Notifying partner ${partner.userName} that chat ended`);
      io.to(partner.socketId).emit('chat_ended', {
        chatId,
        endedBy: userId,
        endedByName: userName
      });
    } else {
      console.log(`Partner ${partnerId} not found online`);
    }
    
    // Also notify the sender that chat ended (so they can redirect too)
    socket.emit('chat_ended', {
      chatId,
      endedBy: userId,
      endedByName: userName
    });
    
    // Remove from active chats
    if (activeChats) {
      for (const [id, chat] of activeChats) {
        if ((chat.user1 === userId || chat.user2 === userId) && 
            (chat.user1 === partnerId || chat.user2 === partnerId)) {
          activeChats.delete(id);
          console.log(`Removed chat ${id} from active chats`);
          break;
        }
      }
    }
  });

  // CHAT MESSAGES
  socket.on('send_message', async (data) => {
    const { message, receiverId, senderId, senderName, senderAvatar, timestamp } = data;
    const messageId = uuidv4();
    await runQuery(
      'INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)',
      [messageId, senderId, receiverId, message]
    );
    
    const receiver = onlineUsers.get(receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit('new_message', {
        id: messageId,
        message,
        senderId,
        senderName,
        senderAvatar,
        timestamp,
        isOwn: false
      });
    }
  });

  // TYPING INDICATORS
  socket.on('typing_start', ({ receiverId, senderId, senderName }) => {
    const receiver = onlineUsers.get(receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit('user_typing', { userId: senderId, userName: senderName });
    }
  });

  socket.on('typing_stop', ({ receiverId, senderId }) => {
    const receiver = onlineUsers.get(receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit('user_stop_typing', { userId: senderId });
    }
  });

  // CALL SIGNALING
  socket.on('initiate_call', (data) => {
    const { callerId, callerName, callerAvatar, receiverId, callType } = data;
    const receiver = onlineUsers.get(receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit('incoming_call', {
        callId: uuidv4(),
        callerId,
        callerName,
        callerAvatar,
        callType
      });
    }
  });

  socket.on('accept_call', (data) => {
    const { callerId, receiverId, receiverName, callId } = data;
    const caller = onlineUsers.get(callerId);
    if (caller) {
      io.to(caller.socketId).emit('call_accepted', { receiverId, receiverName, callId });
    }
  });

  socket.on('reject_call', (data) => {
    const { callerId, callId } = data;
    const caller = onlineUsers.get(callerId);
    if (caller) {
      io.to(caller.socketId).emit('call_rejected', { callId });
    }
  });

  socket.on('end_call', (data) => {
    const { callerId, receiverId, callId } = data;
    const caller = onlineUsers.get(callerId);
    const receiver = onlineUsers.get(receiverId);
    if (caller) io.to(caller.socketId).emit('call_ended', { callId });
    if (receiver) io.to(receiver.socketId).emit('call_ended', { callId });
  });

  // WebRTC SIGNALING
  socket.on('webrtc_offer', ({ targetUserId, offer }) => {
    const target = onlineUsers.get(targetUserId);
    if (target) {
      io.to(target.socketId).emit('webrtc_offer', { offer, from: socket.id });
    }
  });

  socket.on('webrtc_answer', ({ targetUserId, answer }) => {
    const target = onlineUsers.get(targetUserId);
    if (target) {
      io.to(target.socketId).emit('webrtc_answer', { answer, from: socket.id });
    }
  });

  socket.on('webrtc_ice_candidate', ({ targetUserId, candidate }) => {
    const target = onlineUsers.get(targetUserId);
    if (target) {
      io.to(target.socketId).emit('webrtc_ice_candidate', { candidate, from: socket.id });
    }
  });
  

  // DISCONNECT HANDLER - Add/Replace this in your server.js
socket.on('disconnect', async () => {
  console.log('🔌 Client disconnected. Socket ID:', socket.id);
  
  let disconnectedUser = null;
  
  // Find disconnected user
  for (const [userId, data] of onlineUsers) {
    if (data.socketId === socket.id) {
      disconnectedUser = { userId, userName: data.userName };
      onlineUsers.delete(userId);
      await runQuery('UPDATE users SET is_online = 0 WHERE id = ?', [userId]);
      console.log(`Found disconnected user: ${disconnectedUser.userName} (${disconnectedUser.userId})`);
      break;
    }
  }
  
  // If a user disconnected, check if they were in an active chat or call
  if (disconnectedUser && activeChats && activeChats.size > 0) {
    console.log(`Checking active chats for user ${disconnectedUser.userName}...`);
    
    for (const [chatId, chat] of activeChats) {
      if (chat.user1 === disconnectedUser.userId || chat.user2 === disconnectedUser.userId) {
        const partnerId = chat.user1 === disconnectedUser.userId ? chat.user2 : chat.user1;
        const partner = onlineUsers.get(partnerId);
        
        console.log(`User was in chat ${chatId} with partner ${partnerId}`);
        
        if (partner) {
          console.log(`Notifying partner ${partner.userName} that ${disconnectedUser.userName} disconnected`);
          io.to(partner.socketId).emit('partner_disconnected', {
            partnerId: disconnectedUser.userId,
            partnerName: disconnectedUser.userName
          });
        }
        
        activeChats.delete(chatId);
        console.log(`Removed chat ${chatId} from active chats`);
        break;
      }
    }
  }
  
  // Also notify all users that this user disconnected (for UI updates)
  if (disconnectedUser) {
    io.emit('user_disconnected', {
      userId: disconnectedUser.userId,
      userName: disconnectedUser.userName
    });
  }
  
  // Remove from queues
  chatQueue = chatQueue.filter(u => u.socketId !== socket.id);
  callQueue = callQueue.filter(u => u.socketId !== socket.id);
  
  // Update online users list
  if (disconnectedUser) {
    console.log(`👋 ${disconnectedUser.userName} (${disconnectedUser.userId}) disconnected`);
    const onlineList = Array.from(onlineUsers.values()).map(u => ({
      userId: u.userId,
      userName: u.userName,
      userAvatar: u.userAvatar
    }));
    io.emit('online_users', onlineList);
  }
  
  console.log(`Remaining online users: ${onlineUsers.size}`);
});


  // DISCONNECT HANDLER - Notifies partner when user disconnects
  socket.on('disconnect', async () => {
    console.log('🔌 Client disconnected. Socket ID:', socket.id);
    
    let disconnectedUser = null;
    
    // Find disconnected user
    for (const [userId, data] of onlineUsers) {
      if (data.socketId === socket.id) {
        disconnectedUser = { userId, userName: data.userName };
        onlineUsers.delete(userId);
        await runQuery('UPDATE users SET is_online = 0 WHERE id = ?', [userId]);
        console.log(`Found disconnected user: ${disconnectedUser.userName} (${disconnectedUser.userId})`);
        break;
      }
    }
    
    // If a user disconnected, check if they were in an active chat
    if (disconnectedUser && activeChats.size > 0) {
      console.log(`Checking active chats for user ${disconnectedUser.userName}...`);
      
      for (const [chatId, chat] of activeChats) {
        if (chat.user1 === disconnectedUser.userId || chat.user2 === disconnectedUser.userId) {
          const partnerId = chat.user1 === disconnectedUser.userId ? chat.user2 : chat.user1;
          const partner = onlineUsers.get(partnerId);
          
          console.log(`User was in chat ${chatId} with partner ${partnerId}`);
          
          if (partner) {
            console.log(`Notifying partner ${partner.userName} that ${disconnectedUser.userName} disconnected`);
            io.to(partner.socketId).emit('partner_disconnected', {
              partnerId: disconnectedUser.userId,
              partnerName: disconnectedUser.userName
            });
          } else {
            console.log(`Partner ${partnerId} is not online`);
          }
          
          activeChats.delete(chatId);
          console.log(`Removed chat ${chatId} from active chats`);
          break;
        }
      }
    }
    
    // Remove from queues
    chatQueue = chatQueue.filter(u => u.socketId !== socket.id);
    callQueue = callQueue.filter(u => u.socketId !== socket.id);
    
    // Update online users list for everyone
    if (disconnectedUser) {
      console.log(`👋 ${disconnectedUser.userName} (${disconnectedUser.userId}) disconnected`);
      const onlineList = Array.from(onlineUsers.values()).map(u => ({
        userId: u.userId,
        userName: u.userName,
        userAvatar: u.userAvatar
      }));
      io.emit('online_users', onlineList);
    }
    
    console.log(`Remaining online users: ${onlineUsers.size}`);
    console.log(`Active chats remaining: ${activeChats.size}`);
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🔐 EasyTalk Backend Server');
  console.log('='.repeat(60));
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`📡 Test: http://localhost:${PORT}/api/test`);
  console.log(`🗄️  Database: SQLite (easytalk.db)`);
  console.log(`🔌 Socket.IO: ✅ Active`);
  console.log(`👥 Matchmaking: Chat & Call queues ready`);
  console.log(`✅ Login only works with registered credentials`);
  console.log('='.repeat(60) + '\n');
});

app.get('/api/test', (req, res) => {
  res.json({ success: true, message: '✅ API is working!', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});