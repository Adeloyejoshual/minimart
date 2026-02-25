// src/config/constants.js - 100% Reliable - No Vite env problems
export const CONFIG = {
  // Your EXACT production values
  API_BASE_URL: 'https://minimart-ivrm.onrender.com',
  CLOUDINARY_CLOUD_NAME: 'di6zeyneq',
  CLOUDINARY_UPLOAD_PRESET: '0HoyRB6wC0eba-Cbat0nhiIRoa8',
  PAYSTACK_PUBLIC_KEY: 'pk_live_3df29ee09fd5f385fc58c289425e033bb4763b28',
  AUTH0_DOMAIN: 'dev-akuuw0q85johcauu.us.auth0.com',
  AUTH0_CLIENT_ID: 'DLaOqwRXO8XXVaAv57cJQAToorkV0x7y',
  AUTH0_REDIRECT_URI: 'https://minimart-ivrm.onrender.com',
  AUTH0_POST_LOGOUT_URI: 'https://minimart-ivrm.onrender.com',
  STREAM_API_KEY: 'amqsdj6yfuva',
  
  // Marketplace settings
  MAX_IMAGES: 12,
  MIN_DESCRIPTION_LENGTH: 30,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ENABLE_PROMOTIONS: true
};

// Export individual constants for easy use
export const {
  API_BASE_URL,
  MAX_IMAGES,
  MIN_DESCRIPTION_LENGTH,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET
} = CONFIG;