const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || (() => { 
  const s = crypto.randomBytes(64).toString('hex'); 
  console.warn('[SECURITY WARNING] JWT_SECRET env var not set! Using randomly generated secret. All tokens will invalidate on restart.'); 
  return s; 
})();
module.exports = { JWT_SECRET };
