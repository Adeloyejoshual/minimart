// App.jsx - HARDCODED VALUES FROM YOUR SCREENSHOT
import React, { useState, useEffect } from "react";

const DOMAIN = "dev-akuuw0q85johcauu.us.auth0.com";
const CLIENT_ID = "DLaOqwRXO8XXVaAv57cJQAToorkV0x7y";
const REDIRECT_URI = "https://minimart-ivrm.onrender.com/";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for auth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('code')) {
      window.history.replaceState({}, '', '/');
      setLoading(false);
      return;
    }
    
    // Check stored token
    const token = localStorage.getItem('token');
    if (token) setUser({ name: 'User', email: 'user@example.com' }); // Mock for now
    setLoading(false);
  }, []);

  const login = () => {
    window.location.href = `https://${DOMAIN}/authorize?` +
      `response_type=code&` +
      `client_id=${CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `scope=openid%20profile%20email`;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) return <div style={{padding: 40, textAlign: 'center'}}>Loading...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <h1>🛒 MiniMart Marketplace</h1>
      
      {user ? (
        <div style={{ border: '1px solid #ccc', padding: 20 }}>
          <h3>✅ Welcome {user.name}!</h3>
          <button onClick={logout} style={{background: '#ff6b6b', color: 'white', padding: '10px 20px'}}>
            Logout
          </button>
        </div>
      ) : (
        <div style={{ border: '1px solid #ccc', padding: 20 }}>
          <button onClick={login} style={{background: '#4f46e5', color: 'white', padding: '12px 24px'}}>
            Login with Auth0
          </button>
        </div>
      )}
    </div>
  );
}