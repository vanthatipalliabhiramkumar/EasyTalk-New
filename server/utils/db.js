const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.json');

// Initialize database file if it doesn't exist
const initDB = () => {
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      users: [],
      messages: [],
      calls: [],
      challenges: [
        {
          id: '1',
          title: "Introduce Yourself",
          description: "Record a 30-second introduction about yourself",
          type: "speaking",
          difficulty: "beginner",
          points: 50,
          duration: 5,
          prompt: "Tell me about yourself. What's your name, where are you from, and what do you do?",
          active: true,
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          title: "Describe Your Day",
          description: "Talk about what you did today",
          type: "speaking",
          difficulty: "beginner",
          points: 75,
          duration: 10,
          prompt: "Describe your day from morning to evening. What activities did you do?",
          active: true,
          createdAt: new Date().toISOString()
        },
        {
          id: '3',
          title: "Future Plans",
          description: "Discuss your plans for the future",
          type: "speaking",
          difficulty: "intermediate",
          points: 100,
          duration: 15,
          prompt: "What are your plans for the next 5 years? Where do you see yourself?",
          active: true,
          createdAt: new Date().toISOString()
        },
        {
          id: '4',
          title: "Favorite Movie",
          description: "Talk about your favorite movie",
          type: "speaking",
          difficulty: "intermediate",
          points: 85,
          duration: 12,
          prompt: "What's your favorite movie? Describe the plot and why you like it.",
          active: true,
          createdAt: new Date().toISOString()
        },
        {
          id: '5',
          title: "Travel Experience",
          description: "Share a memorable travel experience",
          type: "speaking",
          difficulty: "advanced",
          points: 120,
          duration: 20,
          prompt: "Describe a memorable travel experience. Where did you go? What happened?",
          active: true,
          createdAt: new Date().toISOString()
        }
      ],
      userChallenges: [],
      aiConversations: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    console.log('✅ Database file created successfully');
  }
};

// Read database
const readDB = () => {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error reading database:', error);
    return { users: [], messages: [], calls: [], challenges: [], userChallenges: [], aiConversations: [] };
  }
};

// Write database
const writeDB = (data) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Error writing database:', error);
    return false;
  }
};

// Find user by ID
const findUserById = (id, db) => {
  return db.users.find(u => u.id === id);
};

// Find user by email
const findUserByEmail = (email, db) => {
  return db.users.find(u => u.email === email);
};

// Find user by mobile
const findUserByMobile = (mobile, db) => {
  return db.users.find(u => u.mobileNumber === mobile);
};

// Update user
const updateUser = (userId, updates, db) => {
  const index = db.users.findIndex(u => u.id === userId);
  if (index !== -1) {
    db.users[index] = { ...db.users[index], ...updates };
    return true;
  }
  return false;
};

module.exports = {
  initDB,
  readDB,
  writeDB,
  findUserById,
  findUserByEmail,
  findUserByMobile,
  updateUser
};