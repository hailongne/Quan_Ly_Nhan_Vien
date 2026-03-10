const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { createChainKpi, listChainKpis, getChainKpiDetails, listChainKpisByDepartment, updateChainKpiWeeks, updateKpiDayWorking, updateChainKpiTotal, disableChainKpi, assignWeekToEmployee, transferKpiToDepartment, listTransferHistoryByDepartment, getAssignmentsForKpi, updateAssignmentStatus, uploadKpiOutputs, getKpiOutputs, deleteKpiOutputItem, deleteKpiOutputLink, listKpiApprovals, updateKpiApprovalStatus } = require('../controllers/kpiController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

function ensureDir(targetPath) {
  if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
}

const kpiOutputStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const taskId = req.params.taskId || 'unknown';
    const fullPath = path.join(__dirname, '..', 'public', 'uploads', 'kpi', 'outputs', `task-${taskId}`);
    ensureDir(fullPath);
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = `task-${req.params.taskId || 'unknown'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    cb(null, `${base}${ext}`);
  }
});

const kpiOutputUpload = multer({
  storage: kpiOutputStorage,
  limits: { fileSize: 25 * 1024 * 1024 }
}).any();

// DEBUG: bypass auth for testing (remove in production)
const getAssignmentsForKpiDebug = async (req, res) => {
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ message: 'Missing id' })
    const { sequelize } = require('../models')
    let rows = []
    const weekIndex = typeof req.query.weekIndex !== 'undefined' ? Number(req.query.weekIndex) : null
    if (weekIndex !== null && !Number.isNaN(weekIndex)) {
      const [weekRows] = await sequelize.query('SELECT start_date, end_date FROM chain_kpi_weeks WHERE chain_kpi_id = ? AND week_index = ? LIMIT 1', { replacements: [id, weekIndex] })
      if (weekRows && weekRows.length > 0) {
        const week = weekRows[0]
        const startRaw = String(week.start_date || '')
        const endRaw = String(week.end_date || '')
        const start = startRaw.split(' ')[0] || startRaw
        const end = endRaw.split(' ')[0] || endRaw
        console.log('[getAssignmentsForKpiDebug] week found', { weekIndex, startRaw, endRaw, start, end })
        const [r] = await sequelize.query('SELECT task_id, chain_kpi_id, kpi_day_id, assignee_user_id, date, assigned_kpi, title, status, created_by, created_at, updated_at FROM chain_kpi_daily_tasks WHERE chain_kpi_id = ? AND date BETWEEN ? AND ? ORDER BY date', { replacements: [id, start, end] })
        console.log('[getAssignmentsForKpiDebug] query result', { count: r ? r.length : 0 })
        rows = r
      } else {
        console.log('[getAssignmentsForKpiDebug] week not found', { weekIndex })
        rows = []
      }
    } else {
      const [r] = await sequelize.query('SELECT task_id, chain_kpi_id, kpi_day_id, assignee_user_id, date, assigned_kpi, title, status, created_by, created_at, updated_at FROM chain_kpi_daily_tasks WHERE chain_kpi_id = ? ORDER BY date', { replacements: [id] })
      rows = r
    }
    return res.json(rows)
  } catch (err) {
    console.error('[getAssignmentsForKpiDebug] error', err)
    return res.status(500).json({ message: 'Failed to fetch assignments' })
  }
}

router.get('/', authenticate, listChainKpis);
router.get('/department', authenticate, listChainKpisByDepartment);
router.get('/transfer-history', authenticate, listTransferHistoryByDepartment);
router.get('/approvals', authenticate, listKpiApprovals);
router.post('/approvals/:approvalId/status', authenticate, updateKpiApprovalStatus);
router.get('/:id', authenticate, getChainKpiDetails);
router.get('/:id/assignments', authenticate, getAssignmentsForKpi);
router.post('/:id/assignments/:taskId/status', authenticate, updateAssignmentStatus);
router.post('/:id/tasks/:taskId/outputs', authenticate, kpiOutputUpload, uploadKpiOutputs);
router.get('/:id/tasks/:taskId/outputs', authenticate, getKpiOutputs);
router.delete('/:id/tasks/:taskId/outputs/items/:outputId', authenticate, deleteKpiOutputItem);
router.delete('/:id/tasks/:taskId/outputs/links/:linkId', authenticate, deleteKpiOutputLink);
router.get('/approvals', authenticate, listKpiApprovals);
router.post('/approvals/:approvalId/status', authenticate, updateKpiApprovalStatus);
router.post('/', authenticate, createChainKpi);
router.post('/:id/days/working', authenticate, updateKpiDayWorking);
router.post('/:id/total', authenticate, updateChainKpiTotal);
router.post('/:id/weeks', authenticate, updateChainKpiWeeks);
router.post('/:id/disable', authenticate, disableChainKpi);
router.post('/:id/assign-week', authenticate, assignWeekToEmployee);
router.post('/:id/transfer', authenticate, transferKpiToDepartment);

module.exports = router;
