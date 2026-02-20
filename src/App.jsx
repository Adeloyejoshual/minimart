// App.jsx - Production-ready with error handling
import React, { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function App() {
  const { 
    isAuthenticated, 
    user, 
    loginWithRedirect, 
    logout, 
    isLoading, 
    error,
    handleRedirectCallback 
  } = useAuth0();

  // Handle Auth0 redirect callback
  useEffect(() => {
    handleRedirectCallback()
      .catch((err) => {
        console.error('Auth0 callback error:', err);
        // Don't throw - let user retry login
      });
  }, [handleRedirectCallback]);

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>Loading MiniMart...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: 'red' }}>
        <h2>Authentication Error</h2>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: 20, 
      maxWidth: 600, 
      margin: '0 auto',
      fontFamily: 'system-ui'
    }}>
      <h1>🛒 MiniMart Auth0 Test</h1>
      
      {isAuthenticated ? (
        <div style={{ border: '1px solid #ccc', padding: 20, borderRadius: 8 }}>
          <h3>✅ Welcome back!</h3>
          <img 
            src={user.picture} 
            alt={user.name} 
            style={{ width: 50, height: 50, borderRadius: '50%' }}
          />
          <p><strong>Hello, {user.name}</strong></p>
          <p><strong>Email:</strong> {user.email}</p>
          {user.email_verified && <p style={{ color: 'green' }}>✅ Email Verified</p>}
          <button 
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            style={{
              background: '#ff6b6b',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            🚪 Logout
          </button>
        </div>
      ) : (
        <div style={{ border: '1px solid #ccc', padding: 20, borderRadius: 8 }}>
          <h3>🔐 Please log in</h3>
          <p>You are not logged in to MiniMart.</p>
          <button 
            onClick={() => loginWithRedirect({ 
              authorizationParams: { 
                prompt: "login",
                screen_hint: "login" 
              } 
            })}
            style={{
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 16
            }}
          >
            🚀 Login with Auth0
          </button>
        </div>
      )}
      
      {/* Debug info for troubleshooting */}
      <details style={{ marginTop: 20, fontSize: 12 }}>
        <summary>Debug Info (click to expand)</summary>
        <pre>{JSON.stringify({ isAuthenticated, isLoading, error: error?.message }, null, 2)}</pre>
      </details>
    </div>
  );
}