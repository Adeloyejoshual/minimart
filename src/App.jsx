// src/App.jsx - FIXED VERSION
import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import TestAuth0 from './components/TestAuth0.jsx'; // Adjust path if needed

function App() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <nav style={{ marginBottom: '2rem' }}>
        <Link to="/" style={{ marginRight: '1rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
          🛒 MiniMart
        </Link>
        <Link to="/marketplace" style={{ marginRight: '1rem' }}>Marketplace</Link>
      </nav>

      <Routes>
        <Route path="/" element={<h1>🏠 Welcome to MiniMart!</h1>} />
        <Route path="/dashboard" element={<h1>📊 Dashboard</h1>} />
        <Route path="/marketplace" element={<h1>🛍️ Marketplace</h1>} />
        <Route path="/test-auth0" element={<TestAuth0 />} />
      </Routes>

      {/* Auth0 Test - Always visible */}
      <div style={{ marginTop: '3rem', padding: '1rem', border: '2px solid #eb5424' }}>
        <TestAuth0 />
      </div>
    </div>
  );
}

export default App; // 👈 THIS LINE WAS MISSING!