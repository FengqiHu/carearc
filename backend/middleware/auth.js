'use strict';

require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'carearc_super_secret_jwt_key_2024';

/**
 * Middleware: verify Bearer JWT and attach decoded payload to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * Factory: return middleware that checks the caller's role.
 *
 * Usage: router.get('/route', authenticateToken, requireRole('doctor'), handler)
 */
function requireRole(role) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Access denied. Requires role: ${role}.` });
    }
    return next();
  };
}

module.exports = { authenticateToken, requireRole };
