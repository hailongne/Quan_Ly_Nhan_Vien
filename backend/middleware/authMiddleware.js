const jwt = require('jsonwebtoken');
const { User } = require('../models');

async function authenticate(req, res, next) {
  try {
    const auth = req.headers.authorization;
    console.log('[authMiddleware] Authorization header:', auth ? '[present]' : '[missing]');
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
    const token = auth.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'change_this_secret');
    } catch (e) {
      console.warn('[authMiddleware] JWT verify failed:', e && e.message);
      return res.status(401).json({ message: 'Invalid token' });
    }
    const user = await User.findByPk(payload.user_id);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    // prevent requests from disabled accounts (role-based)
    if (String(user.role || '').toLowerCase() === 'disabled') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('[authMiddleware] unexpected error:', err);
    return res.status(401).json({ message: 'Invalid token' });
  }
}

module.exports = { authenticate };
