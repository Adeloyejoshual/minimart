// src/pages/SettingsPage.jsx - FIXED with user prop
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ProHeader from '../components/ProHeader';
import BottomNav from '../components/BottomNav';
import { 
  FiUser, FiShield, FiBell, FiCreditCard, FiGlobe, FiMoon, FiSmartphone, 
  FiLogOut, FiHelpCircle, FiCheckCircle, FiMail, FiTag, FiDollarSign 
} from 'react-icons/fi';

const SettingsPage = ({ user }) => {  // 👈 RECEIVE user PROP
  const [activeTab, setActiveTab] = useState('account');
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    marketing: false
  });
  const [language, setLanguage] = useState('English');
  const [theme, setTheme] = useState('light');
  const navigate = useNavigate();

  const tabs = [
    { id: 'account', label: 'Account', icon: FiUser },
    { id: 'security', label: 'Security', icon: FiShield },
    { id: 'notifications', label: 'Notifications', icon: FiBell },
    { id: 'billing', label: 'Billing', icon: FiCreditCard },
    { id: 'preferences', label: 'Preferences', icon: FiGlobe }
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/auth');
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
      { label: 'Personal Info', path: '/profile', icon: FiEdit3 },
      { label: 'Store Settings', path: '/profile', icon: FiShop }
    ],
    security: [
      { label: 'Change Password', path: '#', icon: FiShield },
      { label: 'Enable 2FA', path: '#', icon: FiCheckCircle },
      { label: 'Active Sessions', path: '#', icon: FiSmartphone },
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
      { label: 'Subscription Plan', path: '/subscription', icon: FiCheckCircle },
      { label: 'Transaction History', path: '/billing', icon: FiList }
    ],
    preferences: [
      { label: 'Language', value: language, icon: FiGlobe },
      { label: 'App Theme', value: theme === 'light' ? 'Light' : 'Dark', icon: FiMoon },
      { label: 'Currency', value: 'NGN ₦', icon: FiDollarSign },
      { label: 'Help & Support', path: '/support', icon: FiHelpCircle }
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Pro Header */}
      <ProHeader title="Settings" showBack={true} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-gray-900 to-slate-900 bg-clip-text text-transparent mb-4 drop-shadow-lg">
            Settings
          </h1>
          <p className="text-xl text-gray-600 max-w-md mx-auto">
            Manage your account, preferences, and app settings
          </p>
        </div>

        {/* Tabs Navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-12 bg-white/80 backdrop-blur-xl rounded-3xl p-3 shadow-2xl border border-white/50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-3 px-6 py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-md ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/50 scale-[1.05] -translate-y-1'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50 hover:shadow-lg hover:scale-[1.02]'
              }`}
            >
              <tab.icon className={`w-6 h-6 ${activeTab === tab.id ? 'text-white' : 'text-gray-500'}`} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="space-y-4">
          {settingsData[activeTab].map((item, index) => (
            <div
              key={index}
              className="group bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all group-hover:scale-110 ${
                    item.destructive 
                      ? 'bg-gradient-to-br from-red-500 to-red-600' 
                      : 'bg-gradient-to-br from-blue-500 to-purple-600'
                  }`}>
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{item.label}</h3>
                    {item.value && (
                      <p className="text-sm text-gray-500 mt-1">{item.value}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {item.toggle ? (
                    <button
                      onClick={() => toggleNotification(item.toggle)}
                      className="relative w-14 h-8 bg-gray-200 rounded-full p-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      <div className={`w-6 h-6 bg-blue-600 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                        notifications[item.toggle] ? 'translate-x-6' : 'translate-x-1'
                      }`}></div>
                    </button>
                  ) : item.path ? (
                    <Link
                      to={item.path}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200 whitespace-nowrap"
                    >
                      View →
                    </Link>
                  ) : item.onClick ? (
                    <button
                      onClick={item.onClick}
                      className={`px-6 py-3 font-semibold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200 whitespace-nowrap ${
                        item.destructive
                          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
                          : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700'
                      }`}
                    >
                      {item.destructive ? 'Logout' : 'Action'}
                    </button>
                  ) : null}
                  
                  {!item.toggle && !item.path && !item.onClick && (
                    <div className="w-6 h-6 text-gray-400 group-hover:text-gray-600 transition-colors">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions Footer */}
        <div className="mt-12 pt-12 border-t-2 border-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <Link to="/profile" className="group p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-3xl text-center shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all">
              <FiUser className="w-12 h-12 mx-auto mb-3 group-hover:scale-110" />
              <div className="font-bold text-xl">Profile</div>
            </Link>
            <Link to="/minimart/add" className="group p-6 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-3xl text-center shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all">
              <FiPlus className="w-12 h-12 mx-auto mb-3 group-hover:scale-110" />
              <div className="font-bold text-xl">Add Product</div>
            </Link>
            <Link to="/conversations" className="group p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-3xl text-center shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all">
              <FiMessageSquare className="w-12 h-12 mx-auto mb-3 group-hover:scale-110" />
              <div className="font-bold text-xl">Messages</div>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default SettingsPage;