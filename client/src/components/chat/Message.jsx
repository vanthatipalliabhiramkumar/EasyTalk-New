import React from 'react';
import { format } from 'date-fns';

const Message = ({ message, isOwn }) => {
  const formatTime = (date) => {
    return format(new Date(date), 'hh:mm a');
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-lg px-4 py-2 ${
            isOwn
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-800 shadow-sm'
          }`}
        >
          <p className="break-words">{message.content}</p>
        </div>
        <div
          className={`flex items-center space-x-1 mt-1 text-xs text-gray-500 ${
            isOwn ? 'justify-end' : 'justify-start'
          }`}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isOwn && (
            <span>
              {message.read ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
      
      {!isOwn && (
        <div className="order-0 mr-2">
          <img
            src={message.sender?.avatar}
            alt={message.sender?.fullName}
            className="w-8 h-8 rounded-full"
          />
        </div>
      )}
    </div>
  );
};

export default Message;