// Auth0ProviderWithRedirect.jsx - PRODUCTION READY
import React, { useEffect, useState } from "react";
import { Auth0Provider } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

const Auth0ProviderWithRedirect = ({ children }) => {
  const navigate = useNavigate();
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load config with validation
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
  const redirectUri = import.meta.env.VITE_AUTH0_REDIRECT_URI || window.location.origin;

  // Config validation
  useEffect(() => {
    if (!domain || !clientId) {
      console.error('❌ Missing Auth0 config:', { 
        domain: domain ? 'OK' : 'MISSING',
        clientId: clientId ? `${clientId.slice(0,8)}...` : 'MISSING' 
      });
    }
    setConfigLoaded(true);
  }, [domain, clientId]);

  const onRedirectCallback = (appState) => {
    console.log('🔄 Auth0 redirect callback:', appState?.returnTo);
    
    // Handle callback routes
    const returnTo = appState?.returnTo || "/dashboard";
    
    // Clear any auth state errors
    localStorage.removeItem('auth0_error');
    
    navigate(returnTo, { replace: true });
  };

  // Show loading/error before config loads
  if (!configLoaded) {
    return (
      <div style={{ 
        display: 'flex', 
        minHeight: '100vh', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div>Loading MiniMart...</div>
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri.endsWith('/') ? redirectUri : `${redirectUri}/`,
        audience: audience || undefined, // Optional for API calls
        scope: "openid profile email read:products", // MiniMart scopes
      }}
      onRedirectCallback={onRedirectCallback}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      {children}
    </Auth0Provider>
  );
};

export default Auth0ProviderWithRedirect;