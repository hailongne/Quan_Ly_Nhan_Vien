const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { User } = require('../models');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Root folder for uploaded files
const uploadsRoot = path.join(__dirname, '..', 'public', 'uploads');

function safeUnlink(target) {
  fs.unlink(target, err => {
    if (err && err.code !== 'ENOENT') console.warn('[upload] unlink failed', target, err.message);
  });
}

function removeOldFile(prevPath) {
  if (!prevPath) return;

  // strip origin if absolute URL
  let relPath = prevPath;
  try {
    const url = new URL(prevPath);
    relPath = url.pathname || prevPath;
  } catch (e) {
    // not a URL -> keep as-is
  }

  const cleaned = relPath.replace(/^\/+/, '');
  const rel = cleaned.startsWith('uploads/') ? cleaned.slice('uploads/'.length) : cleaned;
  const abs = path.join(uploadsRoot, rel);
  if (!abs.startsWith(uploadsRoot)) return; // safety guard
  safeUnlink(abs);
}

function ensureDir(targetPath) {
  if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
}

function makeDiskStorage(subFolder) {
  const fullPath = path.join(__dirname, '..', 'public', 'uploads', 'users', subFolder);
  ensureDir(fullPath);
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, fullPath),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const base = `user-${req.params.id || 'unknown'}-${Date.now()}`;
      cb(null, `${base}${ext}`);
    }
  });
}

const avatarUpload = multer({
  storage: makeDiskStorage('avatars'),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(png|jpe?g|gif|webp)$/i.test(file.mimetype || '');
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  }
});

// GET /api/user/dashboard - aggregated data for user's overview
// Unauthenticated debug endpoint for local testing: /api/user/dashboard-debug?user_id=1
router.get('/dashboard-debug', async (req, res) => {
  try {
    const userId = Number(req.query.user_id || req.query.userId || 0);
    if (!userId) return res.status(400).json({ message: 'Missing user_id query parameter' });
    const { sequelize } = require('../models');

    const [rows] = await sequelize.query(
      `SELECT t.task_id, t.chain_kpi_id, t.date, t.assigned_kpi, t.status, t.created_at as assigned_at, t.updated_at as updated_at,
              k.kpi_name, k.department_id, k.end_date, k.start_date
       FROM chain_kpi_daily_tasks t
       LEFT JOIN chain_kpis k ON k.chain_kpi_id = t.chain_kpi_id
       WHERE t.assignee_user_id = ?
       ORDER BY t.updated_at DESC`,
      { replacements: [userId] }
    );

    const assignments = Array.isArray(rows) ? rows : [];

    const today = new Date();

    const myKpisMap = {};
    for (const a of assignments) {
      const id = String(a.chain_kpi_id || '');
      if (!id) continue;
      if (!myKpisMap[id]) myKpisMap[id] = { id: a.chain_kpi_id, name: Array.isArray(a.kpi_name) ? a.kpi_name.join(' / ') : (a.kpi_name || ''), department_id: a.department_id, end_date: a.end_date, assignments: [] };
      myKpisMap[id].assignments.push(a);
    }

    const myKpis = Object.values(myKpisMap).map(k => {
      const totalAssign = k.assignments.reduce((sum, x) => sum + Number(x.assigned_kpi || 0), 0);
      const done = k.assignments.reduce((sum, x) => {
        return sum + (String(x.status).toLowerCase() === 'completed' ? Number(x.assigned_kpi || 0) : 0);
      }, 0);
      const pendingCount = k.assignments.reduce((sum, x) => {
        return sum + (String(x.status).toLowerCase() === 'review' ? Number(x.assigned_kpi || 0) : 0);
      }, 0);
      const inProgressCount = k.assignments.reduce((sum, x) => {
        const s = String(x.status || '').toLowerCase();
        return sum + (s !== 'completed' && s !== 'review' ? Number(x.assigned_kpi || 0) : 0);
      }, 0);
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const overdueCount = k.assignments.reduce((sum, x) => {
        const dateRef = x.date ? new Date(String(x.date)) : (k.end_date ? new Date(String(k.end_date)) : null);
        if (!dateRef) return sum;
        return sum + (dateRef < todayStart && String(x.status || '').toLowerCase() !== 'completed' ? Number(x.assigned_kpi || 0) : 0);
      }, 0);
      const progress = Math.round((done / Math.max(1, totalAssign)) * 100);
      const status = done === totalAssign ? 'Hoàn thành' : (k.assignments.some((x) => String(x.status).toLowerCase() === 'review') ? 'Chờ phê duyệt' : 'Đang thực hiện');
      const lastUpdated = k.assignments.reduce((max, cur) => {
        const t = new Date(String(cur.updated_at || cur.assigned_at || 0)).getTime();
        return t > max ? t : max;
      }, 0);
      return {
        id: k.id,
        name: k.name,
        department_id: k.department_id,
        progress,
        status,
        deadline: k.end_date,
        lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
        totalTasks: totalAssign,
        completedTasks: done,
        pendingTasks: pendingCount,
        inProgressTasks: inProgressCount,
        overdueTasks: overdueCount
      };
    });

    const upcomingDeadlines = myKpis.map(k => {
      const d = k.deadline ? new Date(String(k.deadline)) : null;
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const daysRemaining = d ? Math.ceil((d.getTime() - todayStart.getTime()) / (1000*60*60*24)) : null;
      return { ...k, daysRemaining };
    }).filter(k => k.daysRemaining !== null && k.daysRemaining >= 7 && k.daysRemaining <= 14).sort((a,b) => (a.daysRemaining || 0) - (b.daysRemaining || 0));

    const pendingApprovals = myKpis.filter(k => k.status === 'Chờ phê duyệt');
    const overdueKpis = myKpis.filter(k => k.deadline && new Date(String(k.deadline)) < today && k.progress < 100);

    // Summary should be KPI-level (not task-level) so /user matches /user/tasks expectations
    const total = myKpis.length;
    const completed = myKpis.filter(k => k.progress >= 100 || k.status === 'Hoàn thành').length;
    const pending = pendingApprovals.length;
    const overdue = overdueKpis.length;
    const inProgress = myKpis.filter(k => k.status === 'Đang thực hiện').length;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

    const recentActivities = assignments.map(a => ({ time: a.updated_at || a.assigned_at || null, action: String(a.status || ''), kpiName: Array.isArray(a.kpi_name) ? a.kpi_name.join(' / ') : (a.kpi_name || '') })).sort((x,y) => new Date(y.time).getTime() - new Date(x.time).getTime()).slice(0,10);

    return res.json({ summary: { total, completed, inProgress, pending, overdue, completionRate }, myKpis, upcomingDeadlines, pendingApprovals, overdueKpis, recentActivities });
  } catch (err) {
    console.error('[userRoutes] GET /dashboard-debug failed', err);
    return res.status(500).json({ message: 'Failed to build dashboard (debug)' });
  }
});

// GET /api/user/dashboard - aggregated data for user's overview
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const userId = Number(req.user.user_id || 0);
    const { sequelize } = require('../models');

    // fetch assignments for this user joined with KPI info
    const [rows] = await sequelize.query(
      `SELECT t.task_id, t.chain_kpi_id, t.date, t.assigned_kpi, t.status, t.created_at as assigned_at, t.updated_at as updated_at,
              k.kpi_name, k.department_id, k.end_date, k.start_date
       FROM chain_kpi_daily_tasks t
       LEFT JOIN chain_kpis k ON k.chain_kpi_id = t.chain_kpi_id
       WHERE t.assignee_user_id = ?
       ORDER BY t.updated_at DESC`,
      { replacements: [userId] }
    );

    const assignments = Array.isArray(rows) ? rows : [];

    // compute summary
    const today = new Date();

    // myKpis aggregation
    const myKpisMap = {};
    for (const a of assignments) {
      const id = String(a.chain_kpi_id || '');
      if (!id) continue;
      if (!myKpisMap[id]) myKpisMap[id] = { id: a.chain_kpi_id, name: Array.isArray(a.kpi_name) ? a.kpi_name.join(' / ') : (a.kpi_name || ''), department_id: a.department_id, end_date: a.end_date, assignments: [] };
      myKpisMap[id].assignments.push(a);
    }

    const myKpis = Object.values(myKpisMap).map(k => {
      const totalAssign = k.assignments.reduce((sum, x) => sum + Number(x.assigned_kpi || 0), 0);
      const done = k.assignments.reduce((sum, x) => {
        return sum + (String(x.status).toLowerCase() === 'completed' ? Number(x.assigned_kpi || 0) : 0);
      }, 0);
      const pendingCount = k.assignments.reduce((sum, x) => {
        return sum + (String(x.status).toLowerCase() === 'review' ? Number(x.assigned_kpi || 0) : 0);
      }, 0);
      const inProgressCount = k.assignments.reduce((sum, x) => {
        const s = String(x.status || '').toLowerCase();
        return sum + (s !== 'completed' && s !== 'review' ? Number(x.assigned_kpi || 0) : 0);
      }, 0);
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const overdueCount = k.assignments.reduce((sum, x) => {
        const dateRef = x.date ? new Date(String(x.date)) : (k.end_date ? new Date(String(k.end_date)) : null);
        if (!dateRef) return sum;
        return sum + (dateRef < todayStart && String(x.status || '').toLowerCase() !== 'completed' ? Number(x.assigned_kpi || 0) : 0);
      }, 0);
      const progress = Math.round((done / Math.max(1, totalAssign)) * 100);
      const status = done === totalAssign ? 'Hoàn thành' : (k.assignments.some((x) => String(x.status).toLowerCase() === 'review') ? 'Chờ phê duyệt' : 'Đang thực hiện');
      const lastUpdated = k.assignments.reduce((max, cur) => {
        const t = new Date(String(cur.updated_at || cur.assigned_at || 0)).getTime();
        return t > max ? t : max;
      }, 0);
      return {
        id: k.id,
        name: k.name,
        department_id: k.department_id,
        progress,
        status,
        deadline: k.end_date,
        lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
        totalTasks: totalAssign,
        completedTasks: done,
        pendingTasks: pendingCount,
        inProgressTasks: inProgressCount,
        overdueTasks: overdueCount
      };
    });

    // upcoming deadlines 7-14 days
    const upcomingDeadlines = myKpis.map(k => {
      const d = k.deadline ? new Date(String(k.deadline)) : null;
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const daysRemaining = d ? Math.ceil((d.getTime() - todayStart.getTime()) / (1000*60*60*24)) : null;
      return { ...k, daysRemaining };
    }).filter(k => k.daysRemaining !== null && k.daysRemaining >= 7 && k.daysRemaining <= 14).sort((a,b) => (a.daysRemaining || 0) - (b.daysRemaining || 0));

    const pendingApprovals = myKpis.filter(k => k.status === 'Chờ phê duyệt');
    const overdueKpis = myKpis.filter(k => k.deadline && new Date(String(k.deadline)) < today && k.progress < 100);

    // Summary should be KPI-level (not task-level) so /user matches /user/tasks expectations
    const total = myKpis.length;
    const completed = myKpis.filter(k => k.progress >= 100 || k.status === 'Hoàn thành').length;
    const pending = pendingApprovals.length;
    const overdue = overdueKpis.length;
    const inProgress = myKpis.filter(k => k.status === 'Đang thực hiện').length;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

    // recent activities: use assignment updates
    const recentActivities = assignments.map(a => ({ time: a.updated_at || a.assigned_at || null, action: String(a.status || ''), kpiName: Array.isArray(a.kpi_name) ? a.kpi_name.join(' / ') : (a.kpi_name || '') })).sort((x,y) => new Date(y.time).getTime() - new Date(x.time).getTime()).slice(0,10);

    return res.json({ summary: { total, completed, inProgress, pending, overdue, completionRate }, myKpis, upcomingDeadlines, pendingApprovals, overdueKpis, recentActivities });
  } catch (err) {
    console.error('[userRoutes] GET /dashboard failed', err);
    return res.status(500).json({ message: 'Failed to build dashboard' });
  }
});

const cvUpload = multer({
  storage: makeDiskStorage('cv'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ok = /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/i.test(file.mimetype || '');
    cb(ok ? null : new Error('Only PDF or Word files are allowed'), ok);
  }
});

// GET /api/users/me
router.get('/me', authenticate, async (req, res) => {
  const user = req.user;
  if (!user) return res.status(404).json({ message: 'User not found' });
  const u = { ...user.get() };
  delete u.password;
  res.json(u);
});

// GET /api/users - list users (admin only)
router.get('/', authenticate, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const users = await User.findAll({ order: [['user_id', 'ASC']] });
    const sanitized = users.map(u => {
      const obj = u.get();
      delete obj.password;
      return obj;
    });
    res.json(sanitized);
  } catch (err) {
    console.error('[userRoutes] list users failed', err);
    res.status(500).json({ message: 'Failed to list users' });
  }
});

// GET /api/users/department/:id - list users in a department (admin or same-department leaders)
router.get('/department/:id', authenticate, async (req, res) => {
  try {
    const deptId = Number(req.params.id);
    if (!req.user) return res.status(403).json({ message: 'Forbidden' });
    // allow admins or users from the same department
    if (req.user.role !== 'admin' && Number(req.user.department_id) !== deptId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const users = await User.findAll({ where: { department_id: deptId }, order: [['user_id', 'ASC']] });
    const sanitized = users.map(u => {
      const obj = u.get();
      delete obj.password;
      return obj;
    });
    res.json(sanitized);
  } catch (err) {
    console.error('[userRoutes] list by department failed', err);
    res.status(500).json({ message: 'Failed to list users' });
  }
});

// DELETE /api/users/:id - delete user (admin only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const id = req.params.id;
    const userToDelete = await User.findByPk(id);
    if (!userToDelete) return res.status(404).json({ message: 'User not found' });
    try {
      // remove uploaded files (avatar, cv) before deleting record
      try { removeOldFile(userToDelete.avatar_url); } catch (e) { console.warn('[userRoutes] remove avatar failed', e && e.message ? e.message : e); }
      try { removeOldFile(userToDelete.cv_url); } catch (e) { console.warn('[userRoutes] remove cv failed', e && e.message ? e.message : e); }
      await userToDelete.destroy();
    } catch (err) {
      console.error('[userRoutes] delete user failed', err);
      return res.status(500).json({ message: 'Failed to delete user' });
    }
    res.status(204).end();
  } catch (err) {
    console.error('[userRoutes] delete user failed', err);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

// POST /api/users/:id/disable - disable user (admin only)
router.post('/:id/disable', authenticate, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const id = req.params.id;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    try {
      // remove uploaded files (avatar, cv) before deleting record
      try { removeOldFile(user.avatar_url); } catch (e) { console.warn('[userRoutes] remove avatar failed', e && e.message ? e.message : e); }
      try { removeOldFile(user.cv_url); } catch (e) { console.warn('[userRoutes] remove cv failed', e && e.message ? e.message : e); }
      await user.destroy();
      return res.json({ deletedId: id });
    } catch (err) {
      console.error('[userRoutes] disable(user->delete) failed', err && err.message ? err.message : err);
      if (err && err.parent) console.error('[userRoutes] DB parent error:', err.parent.sqlMessage || err.parent.message || err.parent);
      if (err && err.original) console.error('[userRoutes] DB original error:', err.original.sqlMessage || err.original.message || err.original);
      return res.status(500).json({ message: err && err.message ? err.message : 'Failed to remove user' });
    }
  } catch (err) {
    console.error('[userRoutes] disable user failed', err);
    console.error(err && err.stack);
    return res.status(500).json({ message: err && err.message ? err.message : 'Failed to disable user' });
  }
});

// POST /api/users - create new user (admin only)
router.post('/', authenticate, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

    const payload = req.body || {};
    const passwordRaw = typeof payload.password === 'string' ? payload.password : '';

    // Basic required checks
    if (!payload.name || !payload.username || !payload.email) {
      return res.status(400).json({ message: 'Missing required fields: name, username, email' });
    }

    // hash password if provided, otherwise set a random temporary password
    let hash = null;
    if (passwordRaw) {
      hash = await bcrypt.hash(passwordRaw, 10);
    } else {
      // generate a temporary random password and hash it
      const temp = Math.random().toString(36).slice(2,10);
      hash = await bcrypt.hash(temp, 10);
    }

    const createObj = {
      name: payload.name,
      email: payload.email,
      username: payload.username,
      password: hash,
      phone: payload.phone || null,
      department_id: payload.department_id || null,
      department: payload.department || null,
      department_position: payload.department_position || null,
      address: payload.address || null,
      date_joined: payload.date_joined || null,
      employment_status: payload.employment_status || null,
      official_confirmed_at: payload.employment_status ? new Date() : null,
      remaining_leave_days: payload.remaining_leave_days || null,
      work_shift_start: payload.work_shift_start || null,
      work_shift_end: payload.work_shift_end || null,
      note: payload.note || null,
      role: payload.role || 'user'
    };

    let newUser;
    try {
      newUser = await User.create(createObj);
    } catch (err) {
      console.error('[userRoutes] create user failed:', err);
      // handle unique constraint
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ message: 'Username or email already exists' });
      }
      return res.status(500).json({ message: 'Failed to create user' });
    }

    const safe = { ...newUser.get() };
    delete safe.password;
    return res.status(201).json(safe);
  } catch (err) {
    console.error('[userRoutes] POST / error', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PUT /api/users/:id - update user (admin only)
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const id = req.params.id;
    const payload = req.body || {};

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const updates = {};
    const fields = ['name','email','username','phone','department_id','department','department_position','address','date_joined','employment_status','remaining_leave_days','work_shift_start','work_shift_end','note','role'];
    fields.forEach(f => {
      if (payload[f] !== undefined) updates[f] = payload[f];
    });

    // ghi đè mốc official_confirmed_at mỗi khi trạng thái thay đổi
    if (payload.employment_status !== undefined && payload.employment_status !== user.employment_status) {
      updates.official_confirmed_at = new Date();
    }

    if (payload.password) {
      updates.password = await bcrypt.hash(payload.password, 10);
    }

    try {
      await user.update(updates);
    } catch (err) {
      console.error('[userRoutes] update user failed', err);
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ message: 'Username or email already exists' });
      }
      return res.status(500).json({ message: 'Failed to update user' });
    }

    const safe = { ...user.get() };
    delete safe.password;
    return res.json(safe);
  } catch (err) {
    console.error('[userRoutes] PUT /:id error', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

function sanitizeUser(u) {
  const obj = u.get ? u.get() : { ...u };
  delete obj.password;
  return obj;
}

// POST /api/users/:id/avatar - upload avatar
router.post('/:id/avatar', authenticate, avatarUpload.single('file'), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const id = req.params.id;
    // allow admin or the user themself
    if (req.user.role !== 'admin' && String(req.user.user_id) !== String(id)) return res.status(403).json({ message: 'Forbidden' });
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    removeOldFile(user.avatar_url);
    const publicPath = `/uploads/users/avatars/${req.file.filename}`;
    await user.update({ avatar_url: publicPath });
    return res.json(sanitizeUser(user));
  } catch (err) {
    console.error('[userRoutes] upload avatar failed', err);
    return res.status(500).json({ message: err?.message || 'Failed to upload avatar' });
  }
});

// POST /api/users/:id/cv - upload CV
router.post('/:id/cv', authenticate, cvUpload.single('file'), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const id = req.params.id;
    // allow admin or the user themself
    if (req.user.role !== 'admin' && String(req.user.user_id) !== String(id)) return res.status(403).json({ message: 'Forbidden' });
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    removeOldFile(user.cv_url);
    const publicPath = `/uploads/users/cv/${req.file.filename}`;
    await user.update({ cv_url: publicPath });
    return res.json(sanitizeUser(user));
  } catch (err) {
    console.error('[userRoutes] upload cv failed', err);
    return res.status(500).json({ message: err?.message || 'Failed to upload CV' });
  }
});

module.exports = router;
