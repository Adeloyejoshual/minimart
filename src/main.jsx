// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import Auth0ProviderWithRedirect from './components/Auth0ProviderWithRedirect';
import AppRoutes from './routes/AppRoutes';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Auth0ProviderWithRedirect>
        <AppRoutes />
      </Auth0ProviderWithRedirect>
    </BrowserRouter>
  </React.StrictMode>
);