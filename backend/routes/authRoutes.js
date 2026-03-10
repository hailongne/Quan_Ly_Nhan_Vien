const express = require('express');
const router = express.Router();
const { login, forgotPassword, validateResetToken, resetPassword, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { rateLimit } = require('../utils/rateLimiter');

router.post('/login', login);
router.post('/forgot-password', rateLimit({ windowMs: 60 * 1000, max: 5 }), forgotPassword);
router.get('/reset-password/validate', validateResetToken);
router.post('/reset-password', resetPassword);
router.post('/change-password', authenticate, changePassword);

// Status endpoint for debugging (no sensitive data)
router.get('/status', async (req, res, next) => {
	try {
		const sequelize = require('../config/db');
		try {
			await sequelize.authenticate();
		} catch (err) {
			console.error('[authRoutes] DB auth failed:', err);
			return res.status(500).json({ db: false, jwt: !!process.env.JWT_SECRET });
		}
		return res.json({ db: true, jwt: !!process.env.JWT_SECRET });
	} catch (err) {
		next(err);
	}
});

module.exports = router;
