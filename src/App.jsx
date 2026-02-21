import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';

function App() {
  const location = useLocation();

  return (
    <div style={{ 
      padding: '2rem', 
      maxWidth: '1200px', 
      margin: '0 auto', 
      fontFamily: 'system-ui, sans-serif'
    }}>
      <Nav />
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/marketplace" element={<Marketplace />} />
      </Routes>

      <AuthStatus />
    </div>
  );
}

// Navigation
function Nav() {
  const { isAuthenticated } = useAuth0();
  
  return (
    <nav style={{ 
      marginBottom: '2rem', 
      paddingBottom: '1rem', 
      borderBottom: '1px solid #eee' 
    }}>
      <Link to="/" style={{ 
        fontSize: '2rem', 
        fontWeight: 'bold', 
        color: '#eb5424',
        textDecoration: 'none',
        marginRight: '2rem'
      }}>
        🛒 MiniMart
      </Link>
      <Link to="/" style={{ marginRight: '1rem' }}>Home</Link>
      <Link to="/marketplace" style={{ marginRight: '1rem' }}>Marketplace</Link>
      {isAuthenticated && (
        <Link to="/dashboard" style={{ marginLeft: '1rem' }}>
          Dashboard
        </Link>
      )}
    </nav>
  );
}

// Home
function Home() {
  return (
    <div>
      <h1>🏠 Welcome to MiniMart!</h1>
      <p>Your marketplace for everything local. Login to start selling!</p>
    </div>
  );
}

// Dashboard
function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth0();
  
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please log in to access dashboard.</div>;

  return (
    <div>
      <h1>📊 Dashboard</h1>
      <div style={{ 
        padding: '2rem', 
        background: '#e7f3ff', 
        borderRadius: '8px',
        marginTop: '1rem'
      }}>
        <h2>Welcome back, {user?.name}!</h2>
        <img 
          src={user?.picture} 
          alt="Profile" 
          style={{ width: '80px', borderRadius: '50%' }} 
        />
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>User ID:</strong> {user?.sub}</p>
      </div>
    </div>
  );
}

// Marketplace
function Marketplace() {
  return (
    <div>
      <h1>🛍️ Marketplace</h1>
      <p>Browse local products and services (coming soon).</p>
    </div>
  );
}

// Auth Status Panel
function AuthStatus() {
  const { 
    loginWithRedirect, 
    logout, 
    isAuthenticated, 
    isLoading, 
    user, 
    error 
  } = useAuth0();

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        🔄 Loading Auth0...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '2rem', 
        background: '#f8d7da', 
        color: '#721c24', 
        borderRadius: '8px' 
      }}>
        ❌ Auth0 Error: {error.message}
      </div>
    );
  }

  return (
    <div style={{ 
      marginTop: '3rem', 
      padding: '2rem', 
      border: '2px solid #eb5424', 
      borderRadius: '12px',
      background: '#fff8f5'
    }}>
      <h3 style={{ color: '#eb5424', marginBottom: '1rem' }}>
        🔐 Auth0 Status
      </h3>
      
      <div style={{ marginBottom: '1.5rem' }}>
        <strong>Status: </strong>
        <span style={{ 
          padding: '0.5rem 1rem', 
          borderRadius: '6px',
          background: isAuthenticated ? '#d4edda' : '#f8d7da',
          color: isAuthenticated ? '#155724' : '#721c24',
          fontWeight: 'bold'
        }}>
          {isAuthenticated ? '✅ LOGGED IN' : '❌ LOGGED OUT'}
        </span>
      </div>

      {isAuthenticated && user && (
        <div style={{ 
          marginBottom: '1.5rem', 
          padding: '1rem', 
          background: '#e7f3ff', 
          borderRadius: '8px' 
        }}>
          <h4>👤 {user.name || user.email}</h4>
          <img 
            src={user.picture} 
            alt="Profile" 
            style={{ width: '50px', borderRadius: '50%', marginRight: '1rem' }} 
          />
          <div><strong>ID:</strong> {user.sub}</div>
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
            fontSize: '16px',
            cursor: isAuthenticated ? 'not-allowed' : 'pointer'
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
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            🚪 Logout
          </button>
        )}
      </div>
    </div>
  );
}

export default App;