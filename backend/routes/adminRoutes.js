const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { User } = require('../models');

// GET /api/admins - list admin users (admin only)
router.get('/', authenticate, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const admins = await User.findAll({ where: { role: 'admin' }, order: [['user_id', 'ASC']] });
    const sanitized = admins.map(a => {
      const obj = a.get();
      delete obj.password;
      return obj;
    });
    res.json(sanitized);
  } catch (err) {
    console.error('[adminRoutes] list admins failed', err);
    res.status(500).json({ message: 'Failed to list admins' });
  }
});

// DELETE /api/admins/:id - delete admin (admin only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const id = req.params.id;
    const admin = await User.findByPk(id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (admin.role !== 'admin') return res.status(400).json({ message: 'User is not an admin' });
    await admin.destroy();
    res.status(204).end();
  } catch (err) {
    console.error('[adminRoutes] delete admin failed', err);
    res.status(500).json({ message: 'Failed to delete admin' });
  }
});

module.exports = router;
