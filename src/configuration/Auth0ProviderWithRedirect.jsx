// src/configuration/Auth0ProviderWithRedirect.jsx
import React, { useEffect } from 'react';
import { Auth0Provider } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';

const Auth0ProviderWithRedirect = ({ children }) => {
  const navigate = useNavigate();

  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_AUTH0_REDIRECT_URI || window.location.origin;

  const onRedirectCallback = (appState) => {
    console.log('✅ Auth0 callback success!');
    navigate(appState?.returnTo || '/dashboard', { replace: true });
  };

  // Handle code manually if needed
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (code) {
      console.log('🔑 Auth0 code received:', code.slice(0, 20) + '...');
      // Auth0 SDK handles token exchange automatically
      urlParams.delete('code'); // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    if (error) {
      console.error('❌ Auth0 error:', error);
      urlParams.delete('error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE || undefined,
      }}
      onRedirectCallback={onRedirectCallback}
      cacheLocation="localstorage"
    >
      {children}
    </Auth0Provider>
  );
};

export default Auth0ProviderWithRedirect;