const { User, PasswordReset } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const crypto = require('crypto');
// email sending disabled: remove dependency on mailer for now
// const { sendMail } = require('../utils/mailer');

function maskToken(token) {
  if (typeof token !== 'string' || token.length === 0) return '***';
  if (token.length <= 6) return `${token[0]}***${token[token.length - 1]}`;
  return `${token.slice(0, 3)}***${token.slice(-3)}`;
}

// POST /api/auth/login
// Accepts { identifier | username | email, password }
async function login(req, res) {
  try {
    const rawIdentifier = req.body?.identifier ?? req.body?.username ?? req.body?.email;
    const rawPassword = req.body?.password ?? req.body?.pass;

    const identifier = typeof rawIdentifier === 'string' ? rawIdentifier.trim() : '';
    const password = typeof rawPassword === 'string' ? rawPassword : '';

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    const where = { [Op.or]: [{ username: identifier }, { email: identifier }] };

    let user;
    try {
      user = await User.findOne({ where });
    } catch (err) {
      console.error('[authController] DB query failed:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    // debug: log whether a user was found for this identifier (no sensitive data)
    console.log('[authController] login attempt for identifier:', identifier, 'userFound=', !!user);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (String(user.role || '').toLowerCase() === 'disabled') {
      return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa' });
    }

    const hash = typeof user.password === 'string' ? user.password : '';
    let match = false;
    try {
      match = await bcrypt.compare(password, hash);
    } catch (err) {
      console.error('[authController] bcrypt.compare error:', err);
      return res.status(500).json({ message: 'Password verification failed' });
    }

    if (!match) {
      console.warn('[authController] password did not match for identifier:', identifier);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('[authController] password matched, preparing to sign token for user_id=', user.user_id);
    const payload = { user_id: user.user_id, role: user.role };
    let token;
    try {
      token = jwt.sign(payload, process.env.JWT_SECRET || 'change_this_secret', { expiresIn: '8h' });
      console.log('[authController] token signed successfully');
    } catch (err) {
      console.error('[authController] jwt.sign error:', err);
      return res.status(500).json({ message: 'Token generation failed' });
    }

    const userSafe = { ...user.get() };
    delete userSafe.password;

    return res.json({ token, user: userSafe });
  } catch (err) {
    console.error('[authController] login error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
  try {
    const raw = req.body?.identifier || req.body?.email || req.body?.username || '';
    const identifier = typeof raw === 'string' ? raw.trim() : '';
    if (!identifier) return res.status(400).json({ message: 'Email hoặc username là bắt buộc' });

    const user = await User.findOne({ where: { [Op.or]: [{ email: identifier }, { username: identifier }] } });
    if (!user) {
      return res.json({ message: 'Nếu tài khoản tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await PasswordReset.create({ user_id: user.user_id, token_hash: tokenHash, expires_at: expiresAt, used: false });

    const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontend}/reset-password?token=${token}`;
    console.log(`[auth] Password reset link: ${link}`);
    console.log(`[auth] Password reset token (masked): ${maskToken(token)}`);

    // sendMail is currently disabled in this environment; skip sending email
    console.log('[authController] email sending disabled - password reset link generated for', user.email);

    return res.json({ message: 'Nếu tài khoản tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu' });
  } catch (err) {
    console.error('[authController] forgotPassword error', err);
    return res.json({ message: 'Nếu tài khoản tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu' });
  }
}

// GET /api/auth/reset-password/validate?token=...
async function validateResetToken(req, res) {
  try {
    const token = req.query?.token;
    if (!token) return res.status(400).json({ message: 'Thiếu token' });
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const record = await PasswordReset.findOne({ where: { token_hash: tokenHash, used: false, expires_at: { [Op.gt]: new Date() } } });
    if (!record) return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    return res.json({ message: 'Token hợp lệ', expires_at: record.expires_at });
  } catch (err) {
    console.error('[authController] validateResetToken error', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

function validatePasswordPolicy(pwd) {
  if (typeof pwd !== 'string') return false;
  if (pwd.length < 8) return false;
  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasDigit = /[0-9]/.test(pwd);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);
  return hasLower && hasUpper && hasDigit && hasSpecial;
}

// POST /api/auth/reset-password
async function resetPassword(req, res) {
  try {
    const token = req.body?.token;
    const newPassword = req.body?.newPassword || req.body?.password;
    if (!token || !newPassword) return res.status(400).json({ message: 'Thiếu token hoặc mật khẩu mới' });
    if (!validatePasswordPolicy(newPassword)) {
      return res.status(400).json({ message: 'Mật khẩu phải có tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt' });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const record = await PasswordReset.findOne({ where: { token_hash: tokenHash, used: false, expires_at: { [Op.gt]: new Date() } } });
    if (!record) return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });

    const user = await User.findByPk(record.user_id);
    if (!user) return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });

    const hashed = await bcrypt.hash(String(newPassword), 10);
    user.password = hashed;
    user.password_changed_at = new Date();
    await user.save();

    record.used = true;
    await record.save();

    return res.json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (err) {
    console.error('[authController] resetPassword error', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = { login, forgotPassword, validateResetToken, resetPassword };
// POST /api/auth/change-password - authenticated user changes own password
async function changePassword(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const current = req.body?.currentPassword || req.body?.current || '';
    const newPassword = req.body?.newPassword || req.body?.password || '';
    if (!current || !newPassword) return res.status(400).json({ message: 'Thiếu mật khẩu hiện tại hoặc mật khẩu mới' });
    if (!validatePasswordPolicy(newPassword)) return res.status(400).json({ message: 'Mật khẩu mới không đạt chuẩn' });

    const storedHash = typeof user.password === 'string' ? user.password : '';
    const ok = await bcrypt.compare(String(current), storedHash);
    if (!ok) return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });

    const hashed = await bcrypt.hash(String(newPassword), 10);
    user.password = hashed;
    user.password_changed_at = new Date();
    await user.save();

    return res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error('[authController] changePassword error', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = { login, forgotPassword, validateResetToken, resetPassword, changePassword };
