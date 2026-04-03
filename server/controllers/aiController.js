const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { getGeminiResponse, isAvailable } = require('../config/gemini');

const chatWithAI = async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message required' });
    }
    
    const db = getDB();
    let conversation;
    let messages = [];
    
    if (conversationId) {
      conversation = await db.get('SELECT * FROM ai_conversations WHERE id = ? AND user_id = ?', [conversationId, req.user.id]);
      if (conversation) {
        messages = JSON.parse(conversation.messages || '[]');
      }
    }
    
    if (!conversation) {
      conversation = { id: uuidv4() };
    }
    
    messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
    
    // Get AI response from Gemini
    const aiResponse = await getGeminiResponse(message, req.user.full_name);
    
    messages.push({ role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() });
    
    if (conversationId) {
      await db.run('UPDATE ai_conversations SET messages = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
        [JSON.stringify(messages), conversation.id]);
    } else {
      await db.run('INSERT INTO ai_conversations (id, user_id, title, messages) VALUES (?, ?, ?, ?)',
        [conversation.id, req.user.id, message.substring(0, 50), JSON.stringify(messages)]);
    }
    
    res.json({ 
      success: true, 
      response: aiResponse, 
      conversationId: conversation.id,
      aiAvailable: isAvailable()
    });
    
  } catch (error) {
    console.error('AI error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getConversations = async (req, res) => {
  try {
    const db = getDB();
    const conversations = await db.all(
      'SELECT id, title, created_at, updated_at FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC',
      [req.user.id]
    );
    res.json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteConversation = async (req, res) => {
  try {
    const db = getDB();
    await db.run('DELETE FROM ai_conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { chatWithAI, getConversations, deleteConversation };