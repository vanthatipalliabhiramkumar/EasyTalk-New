const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../easytalk.db'), (err) => {
  if (err) {
    console.error('❌ Database error:', err);
  } else {
    console.log('✅ SQLite database connected');
  }
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

// Initialize database tables
const initDatabase = async () => {
  // Users table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
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

  // Messages table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS messages (
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

  // Calls table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      caller_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      started_at DATETIME,
      ended_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (caller_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    )
  `);

  // AI Conversations table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      messages TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Challenges table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      points INTEGER DEFAULT 50,
      difficulty TEXT DEFAULT 'beginner',
      prompt TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User challenges table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS user_challenges (
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

  // Insert default challenges
  const challengeCount = await getQuery('SELECT COUNT(*) as count FROM challenges');
  if (!challengeCount.count) {
    const defaultChallenges = [
      ['1', 'Introduce Yourself', 'Tell me about yourself in 30 seconds', 50, 'beginner', 'What is your name? Where are you from? What do you do?'],
      ['2', 'Describe Your Day', 'Talk about what you did today', 75, 'beginner', 'Describe your day from morning to evening'],
      ['3', 'Future Plans', 'Discuss your plans for the future', 100, 'intermediate', 'What are your plans for the next 5 years?']
    ];
    
    for (const challenge of defaultChallenges) {
      await runQuery(
        'INSERT INTO challenges (id, title, description, points, difficulty, prompt) VALUES (?, ?, ?, ?, ?, ?)',
        challenge
      );
    }
  }

  console.log('✅ Database tables initialized');
};

module.exports = {
  db,
  runQuery,
  getQuery,
  allQuery,
  initDatabase
};