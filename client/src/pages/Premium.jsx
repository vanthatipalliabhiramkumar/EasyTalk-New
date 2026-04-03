import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/layout/Sidebar';
import { FaCheck, FaCreditCard, FaGooglePay, FaApplePay, FaCrown, FaInfinity } from 'react-icons/fa';
import toast from 'react-hot-toast';

const Premium = () => {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);

  const plans = [
    {
      id: 'unlimited_day',
      name: 'Unlimited Calls - 1 Day',
      price: 3,
      period: 'day',
      features: ['Unlimited calls', 'Basic matching', 'No ads'],
      popular: false
    },
    {
      id: 'priority_day',
      name: 'Unlimited + Priority Match',
      price: 9,
      period: 'day',
      features: ['Unlimited calls', 'Priority matching', 'No ads', 'Faster connections'],
      popular: true
    },
    {
      id: 'monthly_unlimited',
      name: 'Monthly Unlimited Calls',
      price: 89,
      period: 'month',
      features: ['Unlimited calls', 'Basic matching', 'No ads', 'Best for daily practice'],
      popular: false
    },
    {
      id: 'monthly_priority',
      name: 'Monthly Unlimited + Priority',
      price: 250,
      period: 'month',
      features: ['Unlimited calls', 'Priority matching', 'No ads', 'Faster connections', 'Premium support'],
      popular: false
    }
  ];

  const handleSubscribe = () => {
    if (!selectedPlan) {
      toast.error('Please select a plan');
      return;
    }
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }
    
    toast.success(`Subscribed to ${plans.find(p => p.id === selectedPlan)?.name}!`);
    // Here you would integrate actual payment processing
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-block p-3 bg-yellow-100 rounded-full mb-4">
              <FaCrown className="text-4xl text-yellow-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Upgrade to EasyTalk Premium</h1>
            <p className="text-xl text-gray-600">Speak without limits. Learn faster.</p>
            <div className="flex justify-center space-x-4 mt-4">
              <div className="flex items-center text-green-600">
                <FaCheck className="mr-2" /> Unlimited calls
              </div>
              <div className="flex items-center text-green-600">
                <FaCheck className="mr-2" /> Priority matching
              </div>
              <div className="flex items-center text-green-600">
                <FaCheck className="mr-2" /> No ads
              </div>
            </div>
          </div>

          {/* Pricing Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`card cursor-pointer transition-all duration-300 ${
                  selectedPlan === plan.id
                    ? 'ring-2 ring-primary-600 transform scale-105'
                    : 'hover:scale-105'
                }`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {plan.popular && (
                  <div className="bg-primary-600 text-white text-center py-1 rounded-t-xl text-sm font-semibold">
                    MOST POPULAR
                  </div>
                )}
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-800">${plan.price}</span>
                    <span className="text-gray-500">/{plan.period}</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center text-sm text-gray-600">
                        <FaCheck className="text-green-500 mr-2 flex-shrink-0" size={12} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`w-full py-2 rounded-lg font-semibold transition-colors ${
                      selectedPlan === plan.id
                        ? 'btn-primary'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {selectedPlan === plan.id ? 'Selected' : 'Select Plan'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Payment Method</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => setPaymentMethod('upi')}
                className={`p-4 border rounded-lg flex items-center space-x-3 transition-all ${
                  paymentMethod === 'upi'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FaGooglePay className="text-2xl text-blue-600" />
                <div className="text-left">
                  <p className="font-medium">UPI</p>
                  <p className="text-sm text-gray-500">GPay, PhonePe, Paytm</p>
                </div>
              </button>
              
              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-4 border rounded-lg flex items-center space-x-3 transition-all ${
                  paymentMethod === 'card'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FaCreditCard className="text-2xl text-gray-600" />
                <div className="text-left">
                  <p className="font-medium">Credit / Debit Card</p>
                  <p className="text-sm text-gray-500">Visa, MasterCard, RuPay</p>
                </div>
              </button>
            </div>
            
            <button
              onClick={handleSubscribe}
              disabled={!selectedPlan || !paymentMethod}
              className="w-full btn-primary py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pay Securely
            </button>
            
            <p className="text-center text-sm text-gray-500 mt-4">
              🔒 100% Safe & Secure Payments
            </p>
          </div>

          {/* Features List */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Premium Benefits</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <FaInfinity className="text-3xl text-primary-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Unlimited Calls</h3>
                <p className="text-sm text-gray-600">No daily limits on voice and video calls</p>
              </div>
              <div className="text-center">
                <FaCrown className="text-3xl text-primary-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Priority Matching</h3>
                <p className="text-sm text-gray-600">Get matched with partners faster</p>
              </div>
              <div className="text-center">
                <FaCheck className="text-3xl text-primary-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Ad-Free Experience</h3>
                <p className="text-sm text-gray-600">Learn without interruptions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Premium;