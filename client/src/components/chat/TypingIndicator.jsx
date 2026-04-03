import React from 'react';

const TypingIndicator = ({ name }) => {
  return (
    <div className="flex items-center space-x-2">
      <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
        <p className="text-xs text-gray-500 mt-1">{name} is typing...</p>
      </div>
    </div>
  );
};

export default TypingIndicator;