const { sequelize } = require('../models');

const normalizeRole = (value) => String(value || '').toLowerCase();

const isAdmin = (user) => normalizeRole(user && user.role) === 'admin';
const isLeader = (user) => normalizeRole(user && user.role) === 'leader';

function canAssign(user) {
  return isAdmin(user) || isLeader(user);
}

function parseAssigneeIds(input) {
  if (!Array.isArray(input)) return [];
  const ids = input
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0);
  return Array.from(new Set(ids));
}

function buildInClause(values) {
  return values.map(() => '?').join(',');
}

async function detectTaskSchema(transaction) {
  // Prefer probing real tables/columns directly to avoid permission issues on information_schema.
  try {
    await sequelize.query('SELECT assignment_id FROM individual_task_assignees LIMIT 1', { transaction });
    return 'multi';
  } catch (_) {
    // ignore
  }

  try {
    await sequelize.query('SELECT assignee_user_id, assigned_by_user_id FROM individual_tasks LIMIT 1', { transaction });
    return 'legacy';
  } catch (_) {
    // ignore
  }

  try {
    await sequelize.query('SELECT task_id FROM individual_tasks LIMIT 1', { transaction });
    return 'unknown';
  } catch (_) {
    return 'missing';
  }
}

async function supportsRangeColumns(transaction) {
  try {
    await sequelize.query('SELECT start_date, end_date FROM individual_tasks LIMIT 1', { transaction });
    return true;
  } catch (_) {
    return false;
  }
}

async function supportsDueDateColumn(transaction) {
  try {
    await sequelize.query('SELECT due_date FROM individual_tasks LIMIT 1', { transaction });
    return true;
  } catch (_) {
    return false;
  }
}

async function supportsCreatedByColumn(transaction) {
  try {
    await sequelize.query('SELECT created_by_user_id FROM individual_tasks LIMIT 1', { transaction });
    return true;
  } catch (_) {
    return false;
  }
}

async function supportsAssignedByColumn(transaction) {
  try {
    await sequelize.query('SELECT assigned_by_user_id FROM individual_tasks LIMIT 1', { transaction });
    return true;
  } catch (_) {
    return false;
  }
}

async function supportsAssigneeColumn(transaction) {
  try {
    await sequelize.query('SELECT assignee_user_id FROM individual_tasks LIMIT 1', { transaction });
    return true;
  } catch (_) {
    return false;
  }
}

async function supportsAcceptedAtColumn(transaction) {
  try {
    await sequelize.query('SELECT accepted_at FROM individual_task_assignees LIMIT 1', { transaction });
    return true;
  } catch (_) {
    return false;
  }
}

async function supportsSubmissionTable(transaction) {
  try {
    await sequelize.query('SELECT submission_id FROM individual_task_submissions LIMIT 1', { transaction });
    return true;
  } catch (_) {
    return false;
  }
}

async function supportsSubmissionFilesJsonColumn(transaction) {
  try {
    await sequelize.query('SELECT files_json FROM individual_task_submissions LIMIT 1', { transaction });
    return true;
  } catch (_) {
    return false;
  }
}

async function resolveCreatorColumn(transaction) {
  if (await supportsCreatedByColumn(transaction)) return 'created_by_user_id';
  if (await supportsAssignedByColumn(transaction)) return 'assigned_by_user_id';
  return null;
}

function ymdToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolveAuthUserId(user) {
  const raw = user && (user.user_id ?? user.id);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && x.trim()) : [];
  } catch (_) {
    return [];
  }
}

function extractInsertId(queryResult) {
  if (!Array.isArray(queryResult)) return null;
  const first = queryResult[0];
  const second = queryResult[1];

  const idFromFirst = Number(first && first.insertId);
  if (Number.isFinite(idFromFirst) && idFromFirst > 0) return idFromFirst;

  const idFromSecond = Number(second && second.insertId);
  if (Number.isFinite(idFromSecond) && idFromSecond > 0) return idFromSecond;

  return null;
}

async function getLastInsertId(transaction) {
  const [rows] = await sequelize.query('SELECT LAST_INSERT_ID() AS id', { transaction });
  const id = Number(rows && rows[0] && rows[0].id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function getAssignableUsers(req, res) {
  try {
    if (!canAssign(req.user)) return res.status(403).json({ message: 'Forbidden' });
    const authUserId = resolveAuthUserId(req.user);
    if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });

    let rows = [];

    if (isAdmin(req.user)) {
      const [r] = await sequelize.query(
        "SELECT user_id, name, email, role, department_id FROM users WHERE role = 'user' ORDER BY name ASC, user_id ASC"
      );
      rows = r;
    } else {
      const deptId = Number(req.user.department_id || 0);
      if (!deptId) return res.status(400).json({ message: 'Leader chưa có phòng ban' });
      const [r] = await sequelize.query(
        "SELECT user_id, name, email, role, department_id FROM users WHERE role = 'user' AND department_id = ? ORDER BY name ASC, user_id ASC",
        { replacements: [deptId] }
      );
      rows = r;
    }

    return res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('[individualTaskController] getAssignableUsers error', err);
    return res.status(500).json({ message: 'Failed to load assignable users' });
  }
}

async function createTask(req, res) {
  const t = await sequelize.transaction();
  try {
    if (!canAssign(req.user)) {
      await t.rollback();
      return res.status(403).json({ message: 'Forbidden' });
    }
    const authUserId = resolveAuthUserId(req.user);
    if (!authUserId) {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const startDate = req.body?.start_date
      ? String(req.body.start_date).slice(0, 10)
      : (req.body?.due_date ? String(req.body.due_date).slice(0, 10) : null);
    const endDate = req.body?.end_date
      ? String(req.body.end_date).slice(0, 10)
      : (req.body?.due_date ? String(req.body.due_date).slice(0, 10) : null);
    const assigneeIds = parseAssigneeIds(req.body?.assignee_user_ids);

    if (!title) {
      await t.rollback();
      return res.status(400).json({ message: 'Thiếu nội dung công việc' });
    }
    if (!startDate || !endDate) {
      await t.rollback();
      return res.status(400).json({ message: 'Thiếu khoảng thời gian công việc' });
    }

    const today = ymdToday();
    if (startDate < today || endDate < today) {
      await t.rollback();
      return res.status(400).json({ message: 'Ngày công việc không được ở quá khứ' });
    }
    if (startDate > endDate) {
      await t.rollback();
      return res.status(400).json({ message: 'Ngày bắt đầu không được sau ngày kết thúc' });
    }
    if (assigneeIds.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Phải chọn ít nhất 1 nhân viên' });
    }

    const inClause = buildInClause(assigneeIds);
    const [userRows] = await sequelize.query(
      `SELECT user_id, name, role, department_id FROM users WHERE user_id IN (${inClause})`,
      { replacements: assigneeIds, transaction: t }
    );

    const targets = Array.isArray(userRows) ? userRows : [];
    if (targets.length !== assigneeIds.length) {
      await t.rollback();
      return res.status(400).json({ message: 'Có nhân viên không tồn tại' });
    }

    const invalidRole = targets.find((u) => normalizeRole(u.role) !== 'user');
    if (invalidRole) {
      await t.rollback();
      return res.status(400).json({ message: 'Chỉ được giao việc cho tài khoản user' });
    }

    if (isLeader(req.user)) {
      const leaderDept = Number(req.user.department_id || 0);
      if (!leaderDept) {
        await t.rollback();
        return res.status(400).json({ message: 'Leader chưa có phòng ban' });
      }
      const outsider = targets.find((u) => Number(u.department_id || 0) !== leaderDept);
      if (outsider) {
        await t.rollback();
        return res.status(403).json({ message: 'Leader chỉ được giao việc cho nhân viên cùng phòng ban' });
      }
    }

    const schemaMode = await detectTaskSchema(t);

    if (schemaMode === 'missing' || schemaMode === 'unknown') {
      await t.rollback();
      return res.status(500).json({ message: 'Bảng công việc chưa được tạo đúng schema. Vui lòng import migration SQL mới.' });
    }

    const hasRangeCols = await supportsRangeColumns(t);
    const hasDueDateCol = await supportsDueDateColumn(t);
    const creatorColumn = await resolveCreatorColumn(t);
    const hasAssigneeInTask = await supportsAssigneeColumn(t);
    const hasAssignedByInTask = await supportsAssignedByColumn(t);

    if (!creatorColumn) {
      await t.rollback();
      return res.status(500).json({ message: 'Schema tasks thiếu cột người giao việc (created_by_user_id/assigned_by_user_id)' });
    }

    let taskId = null;

    if (schemaMode === 'multi') {
      const compatCols = [];
      const compatVals = [];
      if (hasAssigneeInTask) {
        compatCols.push('assignee_user_id');
        compatVals.push(Number(assigneeIds[0]));
      }
      if (hasAssignedByInTask && creatorColumn !== 'assigned_by_user_id') {
        compatCols.push('assigned_by_user_id');
        compatVals.push(authUserId);
      }
      const compatColsSql = compatCols.length ? `, ${compatCols.join(', ')}` : '';
      const compatPlaceholdersSql = compatVals.length ? `, ${compatVals.map(() => '?').join(', ')}` : '';

      let insertTaskQueryResult;
      if (hasRangeCols && hasDueDateCol) {
        insertTaskQueryResult = await sequelize.query(
          `INSERT INTO individual_tasks (title, description, start_date, end_date, due_date, ${creatorColumn}${compatColsSql}, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?${compatPlaceholdersSql}, NOW(), NOW())`,
          {
            replacements: [title, description || null, startDate, endDate, endDate, authUserId, ...compatVals],
            transaction: t
          }
        );
      } else if (hasRangeCols) {
        insertTaskQueryResult = await sequelize.query(
          `INSERT INTO individual_tasks (title, description, start_date, end_date, ${creatorColumn}${compatColsSql}, created_at, updated_at) VALUES (?, ?, ?, ?, ?${compatPlaceholdersSql}, NOW(), NOW())`,
          {
            replacements: [title, description || null, startDate, endDate, authUserId, ...compatVals],
            transaction: t
          }
        );
      } else if (hasDueDateCol) {
        insertTaskQueryResult = await sequelize.query(
          `INSERT INTO individual_tasks (title, description, due_date, ${creatorColumn}${compatColsSql}, created_at, updated_at) VALUES (?, ?, ?, ?${compatPlaceholdersSql}, NOW(), NOW())`,
          {
            replacements: [title, description || null, endDate, authUserId, ...compatVals],
            transaction: t
          }
        );
      } else {
        await t.rollback();
        return res.status(500).json({ message: 'Schema tasks thiếu cột ngày, vui lòng migrate lại DB' });
      }

      taskId = extractInsertId(insertTaskQueryResult);
      if (!taskId) {
        taskId = await getLastInsertId(t);
      }
      if (!taskId) {
        await t.rollback();
        return res.status(500).json({ message: 'Không lấy được task_id sau khi tạo công việc' });
      }

      for (const uid of assigneeIds) {
        await sequelize.query(
          'INSERT INTO individual_task_assignees (task_id, assignee_user_id, status, assigned_at, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW(), NOW())',
          {
            replacements: [taskId, uid, 'todo'],
            transaction: t
          }
        );
      }
    } else {
      // Legacy schema: one row per assignee in individual_tasks
      for (const uid of assigneeIds) {
        let insertLegacyQueryResult;
        if (hasRangeCols && hasDueDateCol) {
          insertLegacyQueryResult = await sequelize.query(
            'INSERT INTO individual_tasks (title, description, assignee_user_id, assigned_by_user_id, status, start_date, end_date, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
            {
              replacements: [title, description || null, uid, authUserId, 'todo', startDate, endDate, endDate],
              transaction: t
            }
          );
        } else if (hasRangeCols) {
          insertLegacyQueryResult = await sequelize.query(
            'INSERT INTO individual_tasks (title, description, assignee_user_id, assigned_by_user_id, status, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
            {
              replacements: [title, description || null, uid, authUserId, 'todo', startDate, endDate],
              transaction: t
            }
          );
        } else if (hasDueDateCol) {
          insertLegacyQueryResult = await sequelize.query(
            'INSERT INTO individual_tasks (title, description, assignee_user_id, assigned_by_user_id, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
            {
              replacements: [title, description || null, uid, authUserId, 'todo', endDate],
              transaction: t
            }
          );
        } else {
          await t.rollback();
          return res.status(500).json({ message: 'Schema tasks thiếu cột ngày, vui lòng migrate lại DB' });
        }
        if (!taskId) {
          const legacyTaskId = extractInsertId(insertLegacyQueryResult);
          if (legacyTaskId) {
            taskId = legacyTaskId;
          } else {
            taskId = await getLastInsertId(t);
          }
        }
      }

      if (!taskId) {
        await t.rollback();
        return res.status(500).json({ message: 'Không lấy được task_id sau khi tạo công việc' });
      }
    }

    await t.commit();

    return res.status(201).json({
      task_id: taskId,
      title,
      description: description || null,
      start_date: startDate,
      end_date: endDate,
      assignee_user_ids: assigneeIds
    });
  } catch (err) {
    try { await t.rollback(); } catch (_) {}
    console.error('[individualTaskController] createTask error', err);
    const detail = err && (err.sqlMessage || err.message);
    return res.status(500).json({ message: detail ? `Failed to assign task: ${detail}` : 'Failed to assign task' });
  }
}

async function listCreatedTasks(req, res) {
  try {
    if (!canAssign(req.user)) return res.status(403).json({ message: 'Forbidden' });
    const authUserId = resolveAuthUserId(req.user);
    if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });

    const schemaMode = await detectTaskSchema();
    if (schemaMode === 'missing' || schemaMode === 'unknown') return res.json([]);

    const hasRangeCols = await supportsRangeColumns();
    const creatorColumn = await resolveCreatorColumn();

    if (!creatorColumn) return res.json([]);

    const mapLegacyRows = (legacyRows) => (Array.isArray(legacyRows) ? legacyRows : []).map((r) => ({
      task_id: r.task_id,
      title: r.title,
      description: r.description,
      start_date: r.start_date || r.due_date || null,
      end_date: r.end_date || r.due_date || null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      assignees: r.assignee_user_id ? [{ user_id: Number(r.assignee_user_id), name: r.assignee_name || '' }] : []
    }));

    const runLegacy = async () => {
      const [legacyRows] = await sequelize.query(
        `SELECT t.task_id, t.title, t.description,
          ${hasRangeCols ? 't.start_date, t.end_date,' : 'NULL AS start_date, NULL AS end_date,'}
          t.due_date, t.created_at, t.updated_at,
                u.user_id AS assignee_user_id, u.name AS assignee_name
         FROM individual_tasks t
         LEFT JOIN users u ON u.user_id = t.assignee_user_id
         WHERE t.${creatorColumn} = ?
         ORDER BY t.created_at DESC`,
        { replacements: [authUserId] }
      );
      return mapLegacyRows(legacyRows);
    };

    if (schemaMode === 'legacy') {
      return res.json(await runLegacy());
    }

    try {
      const multiDateSelect = hasRangeCols
        ? 't.start_date, t.end_date'
        : 't.due_date AS start_date, t.due_date AS end_date';
      const multiDateGroupBy = hasRangeCols
        ? 't.start_date, t.end_date'
        : 't.due_date';

      const [rows] = await sequelize.query(
        `SELECT t.task_id, t.title, t.description, ${multiDateSelect}, t.created_at, t.updated_at,
                GROUP_CONCAT(CONCAT(u.user_id, ':', COALESCE(u.name, '')) ORDER BY u.name SEPARATOR '||') AS assignees
         FROM individual_tasks t
         LEFT JOIN individual_task_assignees a ON a.task_id = t.task_id
         LEFT JOIN users u ON u.user_id = a.assignee_user_id
         WHERE t.${creatorColumn} = ?
         GROUP BY t.task_id, t.title, t.description, ${multiDateGroupBy}, t.created_at, t.updated_at
         ORDER BY t.created_at DESC`,
        { replacements: [authUserId] }
      );

      const mapped = (Array.isArray(rows) ? rows : []).map((r) => {
        const assigneesRaw = String(r.assignees || '').trim();
        const assignees = assigneesRaw
          ? assigneesRaw.split('||').map((part) => {
              const [idRaw, ...nameParts] = String(part).split(':');
              return {
                user_id: Number(idRaw || 0),
                name: nameParts.join(':') || ''
              };
            }).filter((x) => x.user_id > 0)
          : [];
        return {
          task_id: r.task_id,
          title: r.title,
          description: r.description,
          start_date: r.start_date || null,
          end_date: r.end_date || null,
          created_at: r.created_at,
          updated_at: r.updated_at,
          assignees
        };
      });

      return res.json(mapped);
    } catch (multiErr) {
      console.warn('[individualTaskController] listCreatedTasks multi query failed, fallback legacy:', multiErr && multiErr.message ? multiErr.message : multiErr);
      try {
        return res.json(await runLegacy());
      } catch (legacyErr) {
        console.error('[individualTaskController] listCreatedTasks legacy fallback failed', legacyErr);
        return res.status(500).json({ message: 'Failed to load created tasks' });
      }
    }
  } catch (err) {
    console.error('[individualTaskController] listCreatedTasks error', err);
    return res.status(500).json({ message: 'Failed to load created tasks' });
  }
}

async function listMyAssignments(req, res) {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const authUserId = resolveAuthUserId(req.user);
    if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });

    const schemaMode = await detectTaskSchema();
    if (schemaMode === 'missing' || schemaMode === 'unknown') return res.json([]);

    const hasRangeCols = await supportsRangeColumns();
    const creatorColumn = await resolveCreatorColumn();
    const hasAcceptedAt = await supportsAcceptedAtColumn();
    const hasSubmissions = await supportsSubmissionTable();

    if (!creatorColumn) return res.json([]);

    const runLegacy = async () => {
      const [legacyRows] = await sequelize.query(
        `SELECT t.task_id AS assignment_id, t.task_id, t.status, t.created_at AS assigned_at,
                NULL AS completed_at,
            NULL AS accepted_at,
                t.title, t.description,
                ${hasRangeCols ? 't.start_date, t.end_date,' : 't.due_date AS start_date, t.due_date AS end_date,'}
                t.created_at,
                creator.user_id AS assigned_by_user_id,
          creator.name AS assigned_by_name,
                NULL AS teammate_names,
            COALESCE(u_self.name, CONCAT('User ', t.assignee_user_id)) AS assignee_names,
            1 AS accepted_count,
            1 AS total_assignees,
          0 AS my_submission_count,
            0 AS task_submission_count,
            NULL AS submitted_by_name,
            NULL AS submitted_at
         FROM individual_tasks t
                LEFT JOIN users creator ON creator.user_id = t.${creatorColumn}
                LEFT JOIN users u_self ON u_self.user_id = t.assignee_user_id
         WHERE t.assignee_user_id = ?
         ORDER BY ${hasRangeCols ? 't.end_date' : 't.due_date'} IS NULL, ${hasRangeCols ? 't.end_date' : 't.due_date'} ASC, t.created_at DESC`,
        { replacements: [authUserId] }
      );
      return Array.isArray(legacyRows) ? legacyRows : [];
    };

    if (schemaMode === 'legacy') {
      return res.json(await runLegacy());
    }

    try {
      const [rows] = await sequelize.query(
        `SELECT a.assignment_id, a.task_id, a.status, a.assigned_at, a.completed_at,
                ${hasAcceptedAt ? 'a.accepted_at,' : 'NULL AS accepted_at,'}
                t.title, t.description,
                ${hasRangeCols ? 't.start_date, t.end_date,' : 't.due_date AS start_date, t.due_date AS end_date,'}
                t.created_at,
                creator.user_id AS assigned_by_user_id,
                creator.name AS assigned_by_name,
                (
                  SELECT GROUP_CONCAT(COALESCE(u2.name, CONCAT('User ', a2.assignee_user_id)) ORDER BY u2.name SEPARATOR '||')
                  FROM individual_task_assignees a2
                  LEFT JOIN users u2 ON u2.user_id = a2.assignee_user_id
                  WHERE a2.task_id = a.task_id AND a2.assignee_user_id <> ?
                ) AS teammate_names,
                (
                  SELECT GROUP_CONCAT(COALESCE(u3.name, CONCAT('User ', a3.assignee_user_id)) ORDER BY u3.name SEPARATOR '||')
                  FROM individual_task_assignees a3
                  LEFT JOIN users u3 ON u3.user_id = a3.assignee_user_id
                  WHERE a3.task_id = a.task_id
                ) AS assignee_names,
                (SELECT COUNT(*) FROM individual_task_assignees ax WHERE ax.task_id = a.task_id) AS total_assignees,
                (
                  SELECT COUNT(*)
                  FROM individual_task_assignees ay
                  WHERE ay.task_id = a.task_id
                    ${hasAcceptedAt ? 'AND ay.accepted_at IS NOT NULL' : ''}
                ) AS accepted_count,
                ${hasSubmissions
                  ? '(SELECT COUNT(*) FROM individual_task_submissions s WHERE s.task_id = a.task_id AND s.assignee_user_id = ?)'
                  : '0'} AS my_submission_count,
                ${hasSubmissions
                  ? '(SELECT COUNT(*) FROM individual_task_submissions sx WHERE sx.task_id = a.task_id)'
                  : '0'} AS task_submission_count,
                ${hasSubmissions
                  ? `(SELECT COALESCE(u4.name, CONCAT('User ', s1.assignee_user_id))
                      FROM individual_task_submissions s1
                      LEFT JOIN users u4 ON u4.user_id = s1.assignee_user_id
                      WHERE s1.task_id = a.task_id
                      ORDER BY s1.submitted_at ASC
                      LIMIT 1)`
                  : 'NULL'} AS submitted_by_name,
                ${hasSubmissions
                  ? `(SELECT s2.submitted_at
                      FROM individual_task_submissions s2
                      WHERE s2.task_id = a.task_id
                      ORDER BY s2.submitted_at ASC
                      LIMIT 1)`
                  : 'NULL'} AS submitted_at
         FROM individual_task_assignees a
         INNER JOIN individual_tasks t ON t.task_id = a.task_id
                LEFT JOIN users creator ON creator.user_id = t.${creatorColumn}
         WHERE a.assignee_user_id = ?
         ORDER BY ${hasRangeCols ? 't.end_date' : 't.due_date'} IS NULL, ${hasRangeCols ? 't.end_date' : 't.due_date'} ASC, a.assigned_at DESC`,
        { replacements: [authUserId, ...(hasSubmissions ? [authUserId] : []), authUserId] }
      );

      return res.json(Array.isArray(rows) ? rows : []);
    } catch (multiErr) {
      console.warn('[individualTaskController] listMyAssignments multi query failed, fallback legacy:', multiErr && multiErr.message ? multiErr.message : multiErr);
      try {
        return res.json(await runLegacy());
      } catch (legacyErr) {
        console.error('[individualTaskController] listMyAssignments legacy fallback failed', legacyErr);
        return res.status(500).json({ message: 'Failed to load my assignments' });
      }
    }
  } catch (err) {
    console.error('[individualTaskController] listMyAssignments error', err);
    return res.status(500).json({ message: 'Failed to load my assignments' });
  }
}

async function acceptTask(req, res) {
  const t = await sequelize.transaction();
  try {
    if (!req.user) {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const authUserId = resolveAuthUserId(req.user);
    if (!authUserId) {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const taskId = Number(req.params.taskId);
    if (!Number.isFinite(taskId) || taskId <= 0) {
      await t.rollback();
      return res.status(400).json({ message: 'taskId không hợp lệ' });
    }

    const schemaMode = await detectTaskSchema(t);
    if (schemaMode !== 'multi') {
      await t.rollback();
      return res.status(400).json({ message: 'Tính năng nhận nhiệm vụ chỉ hỗ trợ schema nhiều người thực hiện' });
    }

    const hasAcceptedAt = await supportsAcceptedAtColumn(t);
    if (!hasAcceptedAt) {
      await t.rollback();
      return res.status(500).json({ message: 'Thiếu cột accepted_at. Vui lòng chạy migration mới.' });
    }

    const [rows] = await sequelize.query(
      'SELECT assignment_id, accepted_at FROM individual_task_assignees WHERE task_id = ? AND assignee_user_id = ? LIMIT 1',
      { replacements: [taskId, authUserId], transaction: t }
    );
    if (!rows || rows.length === 0) {
      await t.rollback();
      return res.status(404).json({ message: 'Bạn không được giao nhiệm vụ này' });
    }

    if (!rows[0].accepted_at) {
      await sequelize.query(
        'UPDATE individual_task_assignees SET accepted_at = NOW(), updated_at = NOW() WHERE assignment_id = ?',
        { replacements: [rows[0].assignment_id], transaction: t }
      );
    }

    const [[counts]] = await sequelize.query(
      `SELECT
         (SELECT COUNT(*) FROM individual_task_assignees WHERE task_id = ?) AS total_assignees,
         (SELECT COUNT(*) FROM individual_task_assignees WHERE task_id = ? AND accepted_at IS NOT NULL) AS accepted_count`,
      { replacements: [taskId, taskId], transaction: t }
    );

    await t.commit();
    return res.json({
      task_id: taskId,
      accepted_count: Number(counts && counts.accepted_count) || 0,
      total_assignees: Number(counts && counts.total_assignees) || 0
    });
  } catch (err) {
    try { await t.rollback(); } catch (_) {}
    console.error('[individualTaskController] acceptTask error', err);
    return res.status(500).json({ message: 'Failed to accept task' });
  }
}

async function submitTaskResult(req, res) {
  const t = await sequelize.transaction();
  try {
    if (!req.user) {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const authUserId = resolveAuthUserId(req.user);
    if (!authUserId) {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const taskId = Number(req.params.taskId);
    if (!Number.isFinite(taskId) || taskId <= 0) {
      await t.rollback();
      return res.status(400).json({ message: 'taskId không hợp lệ' });
    }

    const schemaMode = await detectTaskSchema(t);
    if (schemaMode !== 'multi') {
      await t.rollback();
      return res.status(400).json({ message: 'Tính năng nộp kết quả chỉ hỗ trợ schema nhiều người thực hiện' });
    }

    const hasAcceptedAt = await supportsAcceptedAtColumn(t);
    const hasSubmissions = await supportsSubmissionTable(t);
    const hasSubmissionFilesJson = await supportsSubmissionFilesJsonColumn(t);
    if (!hasAcceptedAt || !hasSubmissions) {
      await t.rollback();
      return res.status(500).json({ message: 'Thiếu bảng/cột cho tính năng nộp kết quả. Vui lòng chạy migration mới.' });
    }

    const linkUrl = String(req.body?.link_url || '').trim();
    const note = String(req.body?.note || '').trim();
    const files = Array.isArray(req.files) ? req.files : [];
    const fileUrls = files
      .map((f) => (f && f.filename ? `/uploads/individual-tasks/submissions/${f.filename}` : ''))
      .filter(Boolean);
    const fileUrl = fileUrls.length > 0 ? fileUrls[0] : '';

    if (!linkUrl && fileUrls.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Cần nộp ít nhất 1 link hoặc 1 ảnh/tệp' });
    }

    const [assignRows] = await sequelize.query(
      'SELECT assignment_id, accepted_at FROM individual_task_assignees WHERE task_id = ? AND assignee_user_id = ? LIMIT 1',
      { replacements: [taskId, authUserId], transaction: t }
    );
    if (!assignRows || assignRows.length === 0) {
      await t.rollback();
      return res.status(404).json({ message: 'Bạn không được giao nhiệm vụ này' });
    }
    if (!assignRows[0].accepted_at) {
      await t.rollback();
      return res.status(400).json({ message: 'Bạn cần nhận nhiệm vụ trước khi nộp kết quả' });
    }

    const [[counts]] = await sequelize.query(
      `SELECT
         (SELECT COUNT(*) FROM individual_task_assignees WHERE task_id = ?) AS total_assignees,
         (SELECT COUNT(*) FROM individual_task_assignees WHERE task_id = ? AND accepted_at IS NOT NULL) AS accepted_count`,
      { replacements: [taskId, taskId], transaction: t }
    );

    const total = Number(counts && counts.total_assignees) || 0;
    const accepted = Number(counts && counts.accepted_count) || 0;
    if (!total || accepted < total) {
      await t.rollback();
      return res.status(400).json({ message: `Chưa đủ người nhận nhiệm vụ (${accepted}/${total})` });
    }

    const [[submitted]] = await sequelize.query(
      'SELECT COUNT(*) AS cnt FROM individual_task_submissions WHERE task_id = ?',
      { replacements: [taskId], transaction: t }
    );
    if (Number(submitted && submitted.cnt) > 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Nhiệm vụ này đã có người nộp kết quả' });
    }

    if (hasSubmissionFilesJson) {
      await sequelize.query(
        `INSERT INTO individual_task_submissions (task_id, assignee_user_id, file_url, files_json, link_url, note, submitted_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
        {
          replacements: [taskId, authUserId, fileUrl || null, JSON.stringify(fileUrls), linkUrl || null, note || null],
          transaction: t
        }
      );
    } else {
      await sequelize.query(
        `INSERT INTO individual_task_submissions (task_id, assignee_user_id, file_url, link_url, note, submitted_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
        {
          replacements: [taskId, authUserId, fileUrl || null, linkUrl || null, note || null],
          transaction: t
        }
      );
    }

    // One approved submission means the whole task is considered completed for all assigned users.
    await sequelize.query(
      'UPDATE individual_task_assignees SET status = ?, completed_at = NOW(), updated_at = NOW() WHERE task_id = ?',
      { replacements: ['completed', taskId], transaction: t }
    );

    await t.commit();
    return res.json({ message: 'Đã nộp kết quả', task_id: taskId, file_url: fileUrl || null, file_urls: fileUrls, link_url: linkUrl || null });
  } catch (err) {
    try { await t.rollback(); } catch (_) {}
    console.error('[individualTaskController] submitTaskResult error', err);
    return res.status(500).json({ message: 'Failed to submit task result' });
  }
}

async function listCreatedTaskOverview(req, res) {
  try {
    if (!canAssign(req.user)) return res.status(403).json({ message: 'Forbidden' });
    const authUserId = resolveAuthUserId(req.user);
    if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });

    const schemaMode = await detectTaskSchema();
    if (schemaMode === 'missing' || schemaMode === 'unknown') return res.json([]);

    const hasRangeCols = await supportsRangeColumns();
    const creatorColumn = await resolveCreatorColumn();
    const hasAcceptedAt = await supportsAcceptedAtColumn();
    const hasSubmissions = await supportsSubmissionTable();
    const hasSubmissionFilesJson = await supportsSubmissionFilesJsonColumn();

    if (!creatorColumn) return res.json([]);

    const dateSelect = hasRangeCols
      ? 't.start_date, t.end_date'
      : 't.due_date AS start_date, t.due_date AS end_date';

    const [taskRows] = await sequelize.query(
      `SELECT t.task_id, t.title, t.description, ${dateSelect}, t.created_at, t.updated_at
       FROM individual_tasks t
       WHERE t.${creatorColumn} = ?
       ORDER BY t.created_at DESC`,
      { replacements: [authUserId] }
    );

    const tasks = Array.isArray(taskRows) ? taskRows : [];
    if (tasks.length === 0) return res.json([]);

    if (schemaMode !== 'multi') {
      const mappedLegacy = tasks.map((t) => ({
        task_id: t.task_id,
        title: t.title,
        description: t.description,
        start_date: t.start_date || null,
        end_date: t.end_date || null,
        created_at: t.created_at,
        updated_at: t.updated_at,
        summary: {
          total_assignees: 1,
          accepted_count: 1,
          completed_count: String(t.status || '').toLowerCase() === 'completed' ? 1 : 0,
          submitted_count: 0
        },
        assignees: [],
        submission: null
      }));
      return res.json(mappedLegacy);
    }

    const result = [];

    for (const task of tasks) {
      const [assigneeRows] = await sequelize.query(
        `SELECT a.assignee_user_id AS user_id,
                u.name,
                a.status,
                ${hasAcceptedAt ? 'a.accepted_at' : 'NULL AS accepted_at'},
                a.completed_at
         FROM individual_task_assignees a
         LEFT JOIN users u ON u.user_id = a.assignee_user_id
         WHERE a.task_id = ?
         ORDER BY u.name, a.assignee_user_id`,
        { replacements: [task.task_id] }
      );

      let submission = null;
      if (hasSubmissions) {
        const [submissionRows] = await sequelize.query(
          `SELECT s.submission_id, s.assignee_user_id AS submitted_by_user_id,
                  COALESCE(u.name, CONCAT('User ', s.assignee_user_id)) AS submitted_by_name,
                  s.file_url,
                  ${hasSubmissionFilesJson ? 's.files_json,' : 'NULL AS files_json,'}
                  s.link_url, s.note, s.submitted_at
           FROM individual_task_submissions s
           LEFT JOIN users u ON u.user_id = s.assignee_user_id
           WHERE s.task_id = ?
           ORDER BY s.submitted_at ASC
           LIMIT 1`,
          { replacements: [task.task_id] }
        );
        if (Array.isArray(submissionRows) && submissionRows.length > 0) {
          const sub = submissionRows[0];
          const filesFromJson = parseJsonArray(sub.files_json);
          const fileUrls = filesFromJson.length > 0
            ? filesFromJson
            : (sub.file_url ? [sub.file_url] : []);
          submission = {
            ...sub,
            file_urls: fileUrls
          };
        }
      }

      const assignees = Array.isArray(assigneeRows) ? assigneeRows : [];
      const totalAssignees = assignees.length;
      const acceptedCount = assignees.reduce((sum, a) => sum + (a.accepted_at ? 1 : 0), 0);
      const completedCountRaw = assignees.reduce((sum, a) => sum + (String(a.status || '').toLowerCase() === 'completed' ? 1 : 0), 0);
      const completedCount = submission ? totalAssignees : completedCountRaw;

      result.push({
        task_id: task.task_id,
        title: task.title,
        description: task.description,
        start_date: task.start_date || null,
        end_date: task.end_date || null,
        created_at: task.created_at,
        updated_at: task.updated_at,
        summary: {
          total_assignees: totalAssignees,
          accepted_count: acceptedCount,
          completed_count: completedCount,
          submitted_count: submission ? 1 : 0
        },
        assignees,
        submission
      });
    }

    return res.json(result);
  } catch (err) {
    console.error('[individualTaskController] listCreatedTaskOverview error', err);
    return res.status(500).json({ message: 'Failed to load task overview' });
  }
}

module.exports = {
  getAssignableUsers,
  createTask,
  listCreatedTasks,
  listMyAssignments,
  acceptTask,
  submitTaskResult,
  listCreatedTaskOverview
};
