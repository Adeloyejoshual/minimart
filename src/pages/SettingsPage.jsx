// src/pages/SettingsPage.jsx - Professional Settings Page
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ProHeader from '../components/ProHeader';
import BottomNav from '../components/BottomNav';
import { 
  FiUser, FiShield, FiBell, FiCreditCard, FiGlobe, FiMoon, FiSmartphone, 
  FiLogOut, FiHelpCircle, FiCheckCircle, FiX, FiEdit3 
} from 'react-icons/fi';

const SettingsPage = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('account');
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false
  });
  const [language, setLanguage] = useState('English');
  const [theme, setTheme] = useState('light');
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const tabs = [
    { id: 'account', label: 'Account', icon: FiUser },
    { id: 'security', label: 'Security', icon: FiShield },
    { id: 'notifications', label: 'Notifications', icon: FiBell },
    { id: 'billing', label: 'Billing', icon: FiCreditCard },
    { id: 'preferences', label: 'Preferences', icon: FiGlobe }
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const toggleNotification = (type) => {
    setNotifications(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const settingsData = {
    account: [
      { label: 'Profile', path: '/profile', icon: FiUser },
      { label: 'Personal Info', path: '/profile/edit', icon: FiEdit3 },
      { label: 'Store Settings', path: '/store', icon: FiShop }
    ],
    security: [
      { label: 'Password', path: '#', icon: FiShield },
      { label: '2FA Setup', path: '#', icon: FiCheckCircle },
      { label: 'Sessions', path: '#', icon: FiSmartphone },
      { label: 'Logout', onClick: handleLogout, icon: FiLogOut, destructive: true }
    ],
    notifications: [
      { label: 'Email Notifications', toggle: 'email', icon: FiMail },
      { label: 'Push Notifications', toggle: 'push', icon: FiBell },
      { label: 'SMS Alerts', toggle: 'sms', icon: FiSmartphone },
      { label: 'Marketing Emails', toggle: 'marketing', icon: FiTag }
    ],
    billing: [
      { label: 'Payment Methods', path: '/billing', icon: FiCreditCard },
      { label: 'Subscription', path: '/subscription', icon: FiCheckCircle },
      { label: 'Transaction History', path: '/transactions', icon: FiList }
    ],
    preferences: [
      { label: 'Language', value: language, icon: FiGlobe },
      { label: 'Theme', value: theme, icon: FiMoon },
      { label: 'Currency', value: 'NGN', icon: FiDollarSign },
      { label: 'Help & Support', path: '/support', icon: FiHelpCircle }
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Pro Header */}
      <ProHeader title="Settings" showBack={true} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs Navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-12 bg-white/70 backdrop-blur-xl rounded-3xl p-2 shadow-xl border border-white/50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25 scale-105'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="space-y-6">
          {settingsData[activeTab].map((item, index) => (
            <div
              key={index}
              className="group bg-white/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/50 hover:shadow-2xl transition-all hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{item.label}</h3>
                    {item.value && (
                      <p className="text-sm text-gray-600">{item.value}</p>
                    )}
                  </div>
                </div>

                {item.toggle ? (
                  <button
                    onClick={() => toggleNotification(item.toggle)}
                    className="w-12 h-12 bg-gray-200 rounded-2xl flex items-center justify-center relative hover:bg-gray-300 transition-colors"
                  >
                    <div className={`w-5 h-5 bg-blue-600 rounded-full shadow-md transform transition-transform ${
                      notifications[item.toggle] ? 'translate-x-6' : 'translate-x-1'
                    }`}></div>
                  </button>
                ) : item.path ? (
                  <button
                    onClick={() => navigate(item.path)}
                    className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-2xl hover:shadow-xl hover:-translate-y-1 transition-all"
                  >
                    Go
                  </button>
                ) : item.onClick ? (
                  <button
                    onClick={item.onClick}
                    className="px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-2xl hover:shadow-xl hover:-translate-y-1 transition-all"
                  >
                    {item.label}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default SettingsPage;