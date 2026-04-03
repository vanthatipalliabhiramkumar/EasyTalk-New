import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { FaRobot, FaUser, FaTrash, FaComment } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import Sidebar from '../layout/Sidebar';

const AITeacher = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (currentConversation) {
      setMessages(currentConversation.messages);
    }
    scrollToBottom();
  }, [currentConversation]);

  const fetchConversations = async () => {
    try {
      const response = await axios.get('/api/ai/conversations');
      setConversations(response.data.conversations);
      
      if (response.data.conversations.length > 0) {
        setCurrentConversation(response.data.conversations[0]);
      } else {
        startNewConversation();
      }
    } catch (error) {
      console.error('Fetch conversations error:', error);
      toast.error('Failed to load conversations');
    }
  };

  const startNewConversation = async () => {
    setMessages([]);
    setCurrentConversation(null);
    setInputMessage('');
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);
    scrollToBottom();

    try {
      const response = await axios.post('/api/ai/chat', {
        message: inputMessage,
        conversationId: currentConversation?._id,
        context: {
          level: 'intermediate',
          topic: null
        }
      });

      const aiMessage = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      
      if (response.data.conversation && !currentConversation) {
        setCurrentConversation(response.data.conversation);
        fetchConversations();
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Failed to get AI response');
      
      // Remove the user message if AI failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const deleteConversation = async (conversationId) => {
    try {
      await axios.delete(`/api/ai/conversations/${conversationId}`);
      toast.success('Conversation deleted');
      
      const updatedConversations = conversations.filter(c => c._id !== conversationId);
      setConversations(updatedConversations);
      
      if (currentConversation?._id === conversationId) {
        if (updatedConversations.length > 0) {
          setCurrentConversation(updatedConversations[0]);
        } else {
          startNewConversation();
        }
      }
    } catch (error) {
      console.error('Delete conversation error:', error);
      toast.error('Failed to delete conversation');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">AI Teacher</h1>
              <p className="text-gray-600">Practice English with your personal AI tutor</p>
            </div>
            <button
              onClick={startNewConversation}
              className="btn-primary flex items-center space-x-2"
            >
              <FaComment />
              <span>New Conversation</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Conversations Sidebar */}
          <div className={`${sidebarOpen ? 'w-64' : 'w-0'} md:w-64 bg-white border-r transition-all duration-300 overflow-hidden flex flex-col`}>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-800">Conversations</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.map(conv => (
                <div
                  key={conv._id}
                  className={`p-3 border-b hover:bg-gray-50 cursor-pointer ${
                    currentConversation?._id === conv._id ? 'bg-primary-50' : ''
                  }`}
                  onClick={() => setCurrentConversation(conv)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {conv.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(conv.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv._id);
                      }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {conversations.length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  No conversations yet
                </div>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 mt-20">
                  <FaRobot className="text-6xl mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">Start a conversation with your AI teacher!</p>
                  <p className="text-sm">Ask questions, practice speaking, or get feedback on your English.</p>
                </div>
              )}
              
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                    <div className="flex items-center space-x-2 mb-1">
                      {msg.role === 'assistant' && (
                        <FaRobot className="text-primary-600" />
                      )}
                      <span className="text-xs text-gray-500">
                        {msg.role === 'assistant' ? 'AI Teacher' : 'You'}
                      </span>
                    </div>
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-primary-600 text-white'
                          : 'bg-white text-gray-800 shadow-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={sendMessage} className="p-4 bg-white border-t">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask me anything about English..."
                  className="flex-1 input-field"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !inputMessage.trim()}
                  className="btn-primary px-6 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Tip: Ask about grammar, vocabulary, pronunciation, or practice conversation
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AITeacher;