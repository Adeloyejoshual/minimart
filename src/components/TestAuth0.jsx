// src/components/TestAuth0.jsx - NO API CALLS
import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const TestAuth0 = () => {
  const { 
    loginWithRedirect, 
    logout, 
    isAuthenticated, 
    isLoading, 
    user,
    error 
  } = useAuth0();

  if (isLoading) {
    return <div style={{ padding: '1rem', textAlign: 'center' }}>🔄 Loading Auth0...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '1rem', color: 'red', border: '1px solid red' }}>
        <h3>❌ Auth0 Error</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '2rem', 
      border: '2px solid #eb5424', 
      borderRadius: '8px',
      background: '#f8f9fa'
    }}>
      <h3 style={{ color: '#eb5424', marginBottom: '1rem' }}>🔐 Auth0 Status</h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <strong>Status:</strong> 
        <span style={{ 
          padding: '0.25rem 0.5rem', 
          borderRadius: '4px',
          background: isAuthenticated ? '#d4edda' : '#f8d7da',
          color: isAuthenticated ? '#155724' : '#721c24',
          marginLeft: '0.5rem'
        }}>
          {isAuthenticated ? '✅ LOGGED IN' : '❌ LOGGED OUT'}
        </span>
      </div>

      {isAuthenticated && user && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#e7f3ff' }}>
          <h4>👤 Welcome, {user.name || user.email}!</h4>
          <img 
            src={user.picture} 
            alt="Profile" 
            style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '50%',
              marginRight: '1rem'
            }} 
          />
          <div>
            <strong>Email:</strong> {user.email}
            <br />
            <strong>ID:</strong> {user.sub?.slice(-8)}...
          </div>
        </div>
      )}

      <div>
        <button 
          onClick={() => loginWithRedirect({ appState: { returnTo: '/dashboard' } })}
          disabled={isAuthenticated}
          style={{ 
            padding: '12px 24px', 
            marginRight: '1rem',
            background: isAuthenticated ? '#ccc' : '#eb5424',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isAuthenticated ? 'not-allowed' : 'pointer',
            fontSize: '16px'
          }}
        >
          🔑 {isAuthenticated ? 'Logged In' : 'Login with Auth0'}
        </button>
        
        {isAuthenticated && (
          <button 
            onClick={() => logout({ returnTo: window.location.origin })}
            style={{ 
              padding: '12px 24px',
              background: '#6772e5',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            🚪 Logout
          </button>
        )}
      </div>
    </div>
  );
};

export default TestAuth0;