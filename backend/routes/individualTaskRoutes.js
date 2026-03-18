const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/authMiddleware');
const {
  getAssignableUsers,
  createTask,
  listCreatedTasks,
  listMyAssignments,
  acceptTask,
  submitTaskResult,
  listCreatedTaskOverview
} = require('../controllers/individualTaskController');

function ensureDir(targetPath) {
  if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
}

const submissionStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const fullPath = path.join(__dirname, '..', 'public', 'uploads', 'individual-tasks', 'submissions');
    ensureDir(fullPath);
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = `task-${req.params.taskId || 'unknown'}-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    cb(null, `${base}${ext}`);
  }
});

const submissionUpload = multer({
  storage: submissionStorage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

router.get('/assignable-users', authenticate, getAssignableUsers);
router.get('/created-by-me', authenticate, listCreatedTasks);
router.get('/created-overview', authenticate, listCreatedTaskOverview);
router.get('/my-assignments', authenticate, listMyAssignments);
router.post('/:taskId/accept', authenticate, acceptTask);
router.post('/:taskId/submit', authenticate, submissionUpload.array('result_files', 10), submitTaskResult);
router.post('/', authenticate, createTask);

module.exports = router;
