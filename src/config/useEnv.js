// src/config/useEnv.js
export const useEnv = () => ({
  cloudinary: {
    cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
    uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  },
  paystack: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
  api: import.meta.env.VITE_API_BASE_URL,
  auth0: {
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    redirectUri: import.meta.env.VITE_AUTH0_REDIRECT_URI,
    postLogoutRedirectUri: import.meta.env.VITE_AUTH0_POST_LOGOUT_REDIRECT_URI
  },
  stream: import.meta.env.VITE_STREAM_API_KEY,
  config: {
    maxImages: parseInt(import.meta.env.VITE_MAX_IMAGES) || 12,
    minDescriptionLength: parseInt(import.meta.env.VITE_MIN_DESCRIPTION_LENGTH) || 30
  }
});