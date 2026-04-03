import React, { useState } from 'react';
import { FaStar, FaClock, FaTrophy } from 'react-icons/fa';

const ChallengeCard = ({ challenge, isDaily, onStart, onSubmit }) => {
  const [response, setResponse] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const difficultyColors = {
    beginner: 'bg-green-100 text-green-700',
    intermediate: 'bg-yellow-100 text-yellow-700',
    advanced: 'bg-red-100 text-red-700'
  };

  const handleSubmit = () => {
    if (response.trim()) {
      onSubmit(challenge._id, response);
      setSubmitted(true);
    }
  };

  if (challenge.completed || submitted) {
    return (
      <div className="card p-6 opacity-75">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">{challenge.title}</h3>
          <FaTrophy className="text-yellow-500 text-2xl" />
        </div>
        <p className="text-gray-600 mb-4">{challenge.description}</p>
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span className="flex items-center">
            <FaStar className="mr-1" /> {challenge.points} points
          </span>
          <span className="flex items-center">
            <FaClock className="mr-1" /> {challenge.duration} min
          </span>
          <span className={`px-2 py-1 rounded-full text-xs ${difficultyColors[challenge.difficulty]}`}>
            {challenge.difficulty}
          </span>
        </div>
        <div className="mt-4 pt-4 border-t">
          <p className="text-green-600 text-sm font-medium">✓ Completed</p>
        </div>
      </div>
    );
  }

  if (challenge.userProgress?.status === 'in-progress') {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">{challenge.title}</h3>
          {isDaily && (
            <span className="bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-full">
              Daily Challenge
            </span>
          )}
        </div>
        <p className="text-gray-600 mb-4">{challenge.description}</p>
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Your Response:</p>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Type your response here..."
            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows="4"
          />
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <span className="flex items-center">
            <FaStar className="mr-1" /> {challenge.points} points
          </span>
          <span className="flex items-center">
            <FaClock className="mr-1" /> {challenge.duration} min
          </span>
          <span className={`px-2 py-1 rounded-full text-xs ${difficultyColors[challenge.difficulty]}`}>
            {challenge.difficulty}
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!response.trim()}
          className="w-full btn-primary disabled:opacity-50"
        >
          Submit Challenge
        </button>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{challenge.title}</h3>
        {isDaily && (
          <span className="bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-full">
            Daily Challenge
          </span>
        )}
      </div>
      <p className="text-gray-600 mb-4">{challenge.description}</p>
      {challenge.prompt && (
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Prompt:</p>
          <p className="text-gray-600">{challenge.prompt}</p>
        </div>
      )}
      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <span className="flex items-center">
          <FaStar className="mr-1" /> {challenge.points} points
        </span>
        <span className="flex items-center">
          <FaClock className="mr-1" /> {challenge.duration} min
        </span>
        <span className={`px-2 py-1 rounded-full text-xs ${difficultyColors[challenge.difficulty]}`}>
          {challenge.difficulty}
        </span>
      </div>
      <button
        onClick={() => onStart(challenge._id)}
        className="w-full btn-primary"
      >
        Start Challenge
      </button>
    </div>
  );
};

export default ChallengeCard;