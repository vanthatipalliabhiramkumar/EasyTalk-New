export const APP_NAME = 'EasyTalk';
export const APP_DESCRIPTION = 'Speak English Confidently';

export const CHALLENGE_TYPES = {
  SPEAKING: 'speaking',
  LISTENING: 'listening',
  VOCABULARY: 'vocabulary',
  GRAMMAR: 'grammar',
  PRONUNCIATION: 'pronunciation',
};

export const DIFFICULTY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
};

export const CALL_TYPES = {
  VOICE: 'voice',
  VIDEO: 'video',
};

export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
};

export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  THEME: 'theme',
};

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
  },
  USERS: {
    ALL: '/api/users',
    ONLINE: '/api/users/online',
    PROFILE: '/api/users/profile',
    STREAK: '/api/users/streak',
    STATS: '/api/users/stats',
  },
  CHAT: {
    SEND: '/api/chat/send',
    RECENT: '/api/chat/recent',
    MESSAGES: (userId) => `/api/chat/${userId}`,
    DELIVERED: (messageId) => `/api/chat/delivered/${messageId}`,
    DELETE: (messageId) => `/api/chat/${messageId}`,
  },
  AI: {
    CHAT: '/api/ai/chat',
    CONVERSATIONS: '/api/ai/conversations',
  },
  CHALLENGES: {
    ALL: '/api/challenges',
    DAILY: '/api/challenges/daily',
    PROGRESS: '/api/challenges/progress',
    START: (id) => `/api/challenges/${id}/start`,
    SUBMIT: (id) => `/api/challenges/${id}/submit`,
  },
};