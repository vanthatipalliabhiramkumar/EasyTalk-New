const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;
let isAvailable = false;

const initGemini = () => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'AIzaSyCo5N8SQ0u3CbHVFOgLMK6I5Id79NuHrpU' && apiKey.length > 10) {
      genAI = new GoogleGenerativeAI(apiKey);
      model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      isAvailable = true;
      console.log('✅ Google Gemini AI configured successfully');
    } else {
      console.log('⚠️ Gemini API key not found. Get free key from: https://aistudio.google.com/');
      console.log('💡 Using smart fallback responses');
    }
  } catch (error) {
    console.log('⚠️ Gemini AI initialization error:', error.message);
    console.log('💡 Using smart fallback responses');
  }
  return { isAvailable, model };
};

const getGeminiResponse = async (prompt, userName) => {
  if (!isAvailable || !model) {
    return getFallbackResponse(prompt, userName);
  }
  
  try {
    const systemPrompt = `You are an expert English teacher named "AI Teacher". Your student's name is ${userName}.

IMPORTANT RULES:
1. Be encouraging and supportive
2. Correct grammar mistakes gently
3. Suggest better vocabulary when appropriate
4. Keep responses friendly and concise (2-4 sentences)
5. Use emojis occasionally 😊
6. Ask follow-up questions to encourage conversation
7. Provide examples when explaining concepts
8. Focus on practical, real-world English usage

Student message: ${prompt}

Your response as AI Teacher:`;
    
    const result = await model.generateContent(systemPrompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini API error:', error.message);
    return getFallbackResponse(prompt, userName);
  }
};

function getFallbackResponse(message, userName) {
  const msg = message.toLowerCase();
  
  if (msg.match(/^(hi|hello|hey)/)) {
    return `Hello ${userName}! 👋 I'm your AI English teacher. I can help you with grammar, vocabulary, pronunciation, conversation, and writing. What would you like to practice today?`;
  }
  if (msg.includes('grammar')) {
    return `📚 **Grammar Lesson**\n\n**Present Simple**: "I study English daily."\n**Past Simple**: "Yesterday, I studied for an hour."\n**Future**: "I will practice tomorrow."\n\nWhich tense would you like to practice? I can give you exercises! 🎯`;
  }
  if (msg.includes('vocabulary')) {
    return `📖 **Vocabulary Builder**\n\n**Word**: "Excellent"\n**Meaning**: Extremely good\n**Example**: "Your English is excellent!"\n\nTry using this word in a sentence! Can you create one? 💡`;
  }
  if (msg.includes('pronunciation')) {
    return `🎤 **Pronunciation Practice**\n\nPractice the 'th' sound:\n- "The weather is wonderful today."\n- "Think, thought, through"\n\n**Tongue Twister**: "She sells seashells by the seashore."\n\nSay this 3 times fast! Which sounds are most challenging? 🗣️`;
  }
  if (msg.includes('speaking') || msg.includes('conversation')) {
    return `🗣️ **Speaking Practice**\n\n**Topic**: Tell me about your favorite hobby\n\nQuestions to answer:\n1. What do you enjoy doing?\n2. How often do you do it?\n3. Why do you enjoy it?\n4. How did you start?\n\nTake your time and give detailed answers! 🎙️`;
  }
  if (msg.includes('writing')) {
    return `✍️ **Writing Practice**\n\n**Prompt**: Describe your perfect day\n\nWrite 5-7 sentences about:\n- Where would you go?\n- What would you do?\n- Who would you be with?\n- Why is it perfect?\n\nShare your response and I'll give feedback! 📝`;
  }
  if (msg.includes('business') || msg.includes('work')) {
    return `💼 **Business English**\n\nCommon phrases:\n- "Think outside the box" (be creative)\n- "Touch base" (make contact)\n- "Get the ball rolling" (start something)\n\nWould you like to practice writing a professional email? 📧`;
  }
  if (msg.includes('travel')) {
    return `✈️ **Travel English**\n\nAt the airport:\n- "Where is the check-in counter?"\n- "Is my flight on time?"\n\nAt the hotel:\n- "I have a reservation under [name]"\n- "What time is check-out?"\n\nPractice these phrases! Which situation do you want to practice? 🌍`;
  }
  
  return `Great question, ${userName}! What would you like to practice? I can help with:\n\n📚 Grammar\n📖 Vocabulary\n🎤 Pronunciation\n🗣️ Speaking/Conversation\n✍️ Writing\n💼 Business English\n✈️ Travel English\n\nJust tell me what you want to learn! 🌟`;
}

module.exports = { initGemini, getGeminiResponse, isAvailable: () => isAvailable };