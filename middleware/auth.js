const jwt = require('jsonwebtoken');
const { jwtVerify } = require('jose');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    // Verify Auth0 JWT (RS256)
    const JWKS = require('jose').createRemoteJWKSet(
      new URL('https://YOUR_DOMAIN.auth0.com/.well-known/jwks.json')
    );
    
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: 'https://YOUR_DOMAIN.auth0.com/',
      audience: 'YOUR_AUDIENCE'
    });

    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

module.exports = { authenticateToken };