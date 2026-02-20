// TestAuth0.jsx - Add this anywhere to test
import { useAuth0 } from '@auth0/auth0-react';

const TestAuth0 = () => {
  const { 
    loginWithRedirect, 
    logout, 
    isAuthenticated, 
    isLoading, 
    user, 
    getAccessTokenSilently,
    error 
  } = useAuth0();

  if (isLoading) return <div>🔄 Loading...</div>;
  if (error) return <div style={{color: 'red'}}>Error: {error.message}</div>;

  return (
    <div style={{ padding: '2rem', border: '1px solid #ccc' }}>
      <h3>🔐 Auth0 Status</h3>
      <p><strong>Authenticated:</strong> {isAuthenticated ? '✅ YES' : '❌ NO'}</p>
      
      {user && (
        <div>
          <h4>User:</h4>
          <pre>{JSON.stringify(user, null, 2)}</pre>
        </div>
      )}
      
      <div style={{ marginTop: '1rem' }}>
        <button 
          onClick={() => loginWithRedirect({ 
            appState: { returnTo: '/dashboard' } 
          })}
          style={{ 
            padding: '0.5rem 1rem', 
            marginRight: '1rem',
            background: '#eb5424',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          🔑 Login with Auth0
        </button>
        
        {isAuthenticated && (
          <button 
            onClick={() => logout({ returnTo: window.location.origin })}
            style={{ 
              padding: '0.5rem 1rem',
              background: '#6772e5',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            🚪 Logout
          </button>
        )}
      </div>
      
      {isAuthenticated && (
        <button 
          onClick={async () => {
            try {
              const token = await getAccessTokenSilently();
              console.log('🎫 Access Token:', token.slice(0, 20) + '...');
              alert('✅ Token received!');
            } catch (e) {
              console.error('Token error:', e);
            }
          }}
        >
          Get API Token
        </button>
      )}
    </div>
  );
};

export default TestAuth0;