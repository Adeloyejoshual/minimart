// src/configuration/Auth0ProviderWithRedirect.jsx - FIXED CALLBACK
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
    // Clean URL completely
    window.history.replaceState({}, '', '/dashboard');
    navigate('/dashboard', { replace: true });
  };

  // Fix callback URL params BEFORE Auth0Provider mounts
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code') || urlParams.has('error')) {
      console.log('🔄 Cleaning Auth0 callback params');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        scope: 'openid profile email'
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