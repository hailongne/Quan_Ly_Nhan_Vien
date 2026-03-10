const { ChainKpi, sequelize } = require('../models');

async function createChainKpi(req, res) {
  try {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

    const {
      start_date, end_date, description, department_id, total_kpi, workdays_count, status, items, kpi_name
    } = req.body;

    if (!start_date || !end_date) return res.status(400).json({ message: 'start_date and end_date are required' });

    const createdBy = req.user.user_id;

    // normalize kpi names: prefer explicit kpi_name (array of strings), otherwise extract names from items
    let names = null;
    if (Array.isArray(kpi_name)) names = kpi_name.map(n => String(n || '').trim());
    else if (Array.isArray(items)) names = items.map(it => String(it?.name || '').trim());

    // IMPORTANT: business rule — allow multiple KPI records for the same department and same month.
    // Rationale: each POST is a new independent KPI issuance. We MUST NOT block or deduplicate by
    // department_id or by start/end date. Therefore we perform a straight insert of a new
    // `chain_kpis` row and generate a completely separate set of `chain_kpi_days` tied to the
    // new `chain_kpi_id`.
    //
    // Transactional requirement: the insert of `chain_kpis` and the generation/inserts of
    // `chain_kpi_days` (and `chain_kpi_weeks`) MUST be atomic. If day/week generation fails,
    // the whole operation should rollback so we don't leave a half-baked KPI record.
    // This ensures independence between KPI records and keeps integrity of daily targets.
    const result = await sequelize.transaction(async (t) => {
      // create chain_kpi within transaction
      const created = await ChainKpi.create({
        created_by: createdBy,
        start_date,
        end_date,
        description: description || null,
        kpi_name: names,
        department_id: department_id || null,
        total_kpi: total_kpi || 0,
        workdays_count: workdays_count || 0,
        status: status || 'draft'
      }, { transaction: t });

      // After creating chain_kpi, populate chain_kpi_days by distributing total_kpi across working days
      const chainKpiId = created.chain_kpi_id;
      const total = Number(created.total_kpi) || 0;

      // iterate dates from start_date to end_date
      const sd = new Date(start_date);
      const ed = new Date(end_date);

      // collect all dates in the range and mark weekends
      const dates = [];
      const cur = new Date(sd);
      while (cur <= ed) {
        const day = cur.getDay(); // 0 Sunday, 6 Saturday
        const isWeekend = (day === 0 || day === 6);
        dates.push({ date: new Date(cur), isWeekend });
        cur.setDate(cur.getDate() + 1);
      }

      const workingDates = dates.filter(d => !d.isWeekend);
      const workingCount = workingDates.length;

      if (workingCount > 0 && total > 0) {
        const base = Math.floor(total / workingCount);
        let remainder = total - base * workingCount;

        // prepare daily targets array; distribution is calculated per KPI independently
        const dailyTargets = dates.map(d => {
          if (d.isWeekend) return { date: d.date, target_value: 0, is_working_day: 0 };
          const tv = base + (remainder > 0 ? 1 : 0);
          if (remainder > 0) remainder -= 1;
          return { date: d.date, target_value: tv, is_working_day: 1 };
        });

        // insert days (transaction-scoped)
        for (const d of dailyTargets) {
          const kpi_current = 0;
          await sequelize.query(
                `INSERT INTO chain_kpi_days (chain_kpi_id, date, target_value, is_working_day, created_by, created_at, updated_at, kpi_current)
                 VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?)`,
                {
                  replacements: [chainKpiId, d.date.toISOString().split('T')[0], d.target_value, d.is_working_day, createdBy, kpi_current],
                  transaction: t
                }
              );
        }

        // compute weekly sums based on 7-day buckets starting from start_date
        const weeksMap = new Map();
        for (const d of dailyTargets) {
          const dayIndex = Math.floor((+d.date - +sd) / (1000 * 60 * 60 * 24));
          const weekIndex = Math.floor(dayIndex / 7);
          const key = String(weekIndex);
          const prev = weeksMap.get(key) || { start: d.date, end: d.date, sum: 0 };
          if (+d.date < +prev.start) prev.start = d.date;
          if (+d.date > +prev.end) prev.end = d.date;
          prev.sum += d.target_value;
          weeksMap.set(key, prev);
        }

        // insert weekly aggregates (transaction-scoped)
        for (const [weekIndex, info] of weeksMap.entries()) {
          await sequelize.query(
            `INSERT INTO chain_kpi_weeks (chain_kpi_id, week_index, start_date, end_date, total_target_value, kpi_total, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            {
              replacements: [chainKpiId, Number(weekIndex), info.start.toISOString().split('T')[0] + ' 00:00:00', info.end.toISOString().split('T')[0] + ' 23:59:59', info.sum, info.sum],
              transaction: t
            }
          );
        }
      }

      // return created record (transaction will commit on success)
      return created;
    });

    // return the created chain_kpi after successful transaction
    res.status(201).json(result);
  } catch (err) {
    console.error('[kpiController] createChainKpi error', err);
    res.status(500).json({ message: 'Failed to create chain_kpi' });
  }
}

async function getChainKpiDetails(req, res) {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    if (!req.user) return res.status(403).json({ message: 'Forbidden' });

    const { ChainKpi, sequelize } = require('../models');
    const kpi = await ChainKpi.findByPk(id);
    if (!kpi) return res.status(404).json({ message: 'KPI not found' });

    const kpiDeptId = Number(kpi.department_id ?? 0);
    const userDeptId = Number(req.user.department_id ?? 0);
    if (req.user.role !== 'admin' && kpiDeptId !== userDeptId) {
      let canAccessByTransfer = false;

      const transferSourceKpiId = Number(kpi.transfer_source_kpi_id ?? 0);
      if (transferSourceKpiId > 0) {
        const [sourceRows] = await sequelize.query(
          'SELECT department_id FROM chain_kpis WHERE chain_kpi_id = ? LIMIT 1',
          { replacements: [transferSourceKpiId] }
        );
        const sourceRow = sourceRows && sourceRows[0] ? sourceRows[0] : null;
        canAccessByTransfer = Number(sourceRow?.department_id ?? 0) === userDeptId;
      }

      if (!canAccessByTransfer) {
        const [targetRows] = await sequelize.query(
          'SELECT chain_kpi_id FROM chain_kpis WHERE transfer_source_kpi_id = ? AND department_id = ? LIMIT 1',
          { replacements: [id, userDeptId] }
        );
        canAccessByTransfer = Array.isArray(targetRows) && targetRows.length > 0;
      }

      if (!canAccessByTransfer) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    // fetch weeks
    const [weeks] = await sequelize.query(
      'SELECT chain_kpi_week_id, chain_kpi_id, week_index, start_date, end_date, total_target_value, kpi_total, created_at, updated_at FROM chain_kpi_weeks WHERE chain_kpi_id = ? ORDER BY week_index',
      { replacements: [id] }
    );

    // fetch days for each week
    for (const w of weeks) {
      // include totalAssigned per day (sum of assigned_kpi from chain_kpi_daily_tasks)
      const [days] = await sequelize.query(
        `SELECT kpi_day_id, chain_kpi_id, date, target_value, is_working_day, created_by, created_at, updated_at, kpi_current, overridden_by, overridden_at,
                (SELECT COALESCE(SUM(assigned_kpi),0) FROM chain_kpi_daily_tasks WHERE chain_kpi_id = ? AND kpi_day_id = chain_kpi_days.kpi_day_id) as totalAssigned
         FROM chain_kpi_days WHERE chain_kpi_id = ? AND date BETWEEN ? AND ? ORDER BY date`,
        { replacements: [id, id, w.start_date, w.end_date] }
      );
      console.log('[getChainKpiDetails] week', w.week_index, 'days sample:', days.slice(0, 3).map((d) => ({ date: d.date, target_value: d.target_value, totalAssigned: d.totalAssigned })));
      w.days = days;
    }

    return res.json({ kpi, weeks });
  } catch (err) {
    console.error('[kpiController] getChainKpiDetails error', err);
    return res.status(500).json({ message: 'Failed to fetch KPI details' });
  }
}

async function listChainKpis(req, res) {
  try {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const [list] = await sequelize.query(
      `SELECT chain_kpi_id, created_by, start_date, end_date, description, kpi_name,
              department_id, transfer_source_kpi_id, total_kpi, workdays_count, status,
              created_at, updated_at
       FROM chain_kpis
       ORDER BY chain_kpi_id DESC`
    );
    res.json(list);
  } catch (err) {
    console.error('[kpiController] listChainKpis error', err);
    res.status(500).json({ message: 'Failed to list chain_kpis' });
  }
}

async function listChainKpisByDepartment(req, res) {
  try {
    if (!req.user) return res.status(403).json({ message: 'Forbidden' });
    const deptId = req.user.department_id || (req.query.department_id ? Number(req.query.department_id) : null);
    if (!deptId) return res.status(400).json({ message: 'Missing department' });
    // allow admin to pass any department via query, leaders/users only for their own department
    if (req.user.role !== 'admin' && Number(deptId) !== Number(req.user.department_id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const [list] = await sequelize.query(
      `SELECT chain_kpi_id, created_by, start_date, end_date, description, kpi_name,
              department_id, transfer_source_kpi_id, total_kpi, workdays_count, status,
              created_at, updated_at
       FROM chain_kpis
       WHERE department_id = ?
       ORDER BY chain_kpi_id DESC`,
      { replacements: [deptId] }
    );
    res.json(list);
  } catch (err) {
    console.error('[kpiController] listChainKpisByDepartment error', err);
    res.status(500).json({ message: 'Failed to list chain_kpis for department' });
  }
}

// markKpiDay removed: right-click day completion is no longer supported.

async function updateChainKpiWeeks(req, res) {
  try {
    const id = req.params.id;
    const { weeks } = req.body;
    if (!id || !Array.isArray(weeks)) return res.status(400).json({ message: 'Missing id or weeks' });
    if (!req.user) return res.status(403).json({ message: 'Forbidden' });

    // ensure KPI belongs to user's department if not admin
    const [[kpiRow]] = await sequelize.query('SELECT department_id FROM chain_kpis WHERE chain_kpi_id = ? LIMIT 1', { replacements: [id] });
    if (!kpiRow) return res.status(404).json({ message: 'KPI not found' });
    const deptId = kpiRow.department_id;
    if (req.user.role !== 'admin' && Number(deptId) !== Number(req.user.department_id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await sequelize.transaction(async (t) => {
      for (const w of weeks) {
        const weekIndex = w.week_index ?? w.id;

        // find week bounds
        const [weekRows] = await sequelize.query(
          'SELECT chain_kpi_week_id, start_date, end_date FROM chain_kpi_weeks WHERE chain_kpi_id = ? AND week_index = ? LIMIT 1',
          { replacements: [id, weekIndex], transaction: t }
        );
        const weekRow = (weekRows && weekRows[0]) ? weekRows[0] : null;

        if (Array.isArray(w.days)) {
          for (const d of w.days) {
            if (!d || !d.date) continue;
            const newTarget = Number(d.target_value) || 0;
            await sequelize.query(
              'UPDATE chain_kpi_days SET target_value = ?, overridden_by = ?, overridden_at = NOW() WHERE chain_kpi_id = ? AND date = ?',
              { replacements: [newTarget, req.user.user_id, id, d.date], transaction: t }
            );
          }
        }

        // recompute week aggregates if we have week bounds
        if (weekRow) {
          const [sumRows] = await sequelize.query(
            'SELECT COALESCE(SUM(target_value),0) as sum FROM chain_kpi_days WHERE chain_kpi_id = ? AND date BETWEEN ? AND ?',
            { replacements: [id, weekRow.start_date, weekRow.end_date], transaction: t }
          );
          const sum = (sumRows && sumRows[0]) ? sumRows[0].sum : 0;
          await sequelize.query(
            'UPDATE chain_kpi_weeks SET total_target_value = ?, kpi_total = ?, updated_at = NOW() WHERE chain_kpi_week_id = ?',
            { replacements: [sum, sum, weekRow.chain_kpi_week_id], transaction: t }
          );
        }
      }
    });

    // return refreshed KPI with weeks and days
    const { ChainKpi } = require('../models');
    const kpi = await ChainKpi.findByPk(id);

    const [weeksRes] = await sequelize.query(
      'SELECT chain_kpi_week_id, chain_kpi_id, week_index, start_date, end_date, total_target_value, kpi_total, created_at, updated_at FROM chain_kpi_weeks WHERE chain_kpi_id = ? ORDER BY week_index',
      { replacements: [id] }
    );

    for (const w of weeksRes) {
      const [days] = await sequelize.query(
        'SELECT kpi_day_id, chain_kpi_id, date, target_value, is_working_day, created_by, created_at, updated_at, kpi_current, overridden_by, overridden_at FROM chain_kpi_days WHERE chain_kpi_id = ? AND date BETWEEN ? AND ? ORDER BY date',
        { replacements: [id, w.start_date, w.end_date] }
      );
      w.days = days;
    }

    return res.json({ kpi, weeks: weeksRes });
  } catch (err) {
    console.error('[kpiController] updateChainKpiWeeks error', err);
    return res.status(500).json({ message: 'Failed to update KPI weeks' });
  }
}

module.exports = { createChainKpi, listChainKpis, getChainKpiDetails, listChainKpisByDepartment, updateChainKpiWeeks, disableChainKpi };

async function updateChainKpiTotal(req, res) {
  try {
    const id = req.params.id;
    const { total_kpi } = req.body;
    console.log('[updateChainKpiTotal] incoming', { id, total_kpi, user: req.user && { user_id: req.user.user_id, role: req.user.role, department_id: req.user.department_id } })
    if (!id || typeof total_kpi === 'undefined') return res.status(400).json({ message: 'Missing id or total_kpi' });
    if (!req.user) return res.status(403).json({ message: 'Forbidden' });

    const [[kpiRow]] = await sequelize.query('SELECT department_id FROM chain_kpis WHERE chain_kpi_id = ? LIMIT 1', { replacements: [id] });
    if (!kpiRow) return res.status(404).json({ message: 'KPI not found' });
    const deptId = kpiRow.department_id;
    if (req.user.role !== 'admin' && Number(deptId) !== Number(req.user.department_id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    try {
      await sequelize.query('UPDATE chain_kpis SET total_kpi = ?, updated_at = NOW() WHERE chain_kpi_id = ?', { replacements: [Number(total_kpi) || 0, id] });
      console.log('[updateChainKpiTotal] update executed')
    } catch (e) {
      console.error('[updateChainKpiTotal] update failed', e && e.stack ? e.stack : e)
      throw e
    }

    try {
      const { ChainKpi } = require('../models');
      const kpi = await ChainKpi.findByPk(id);
      return res.json({ kpi });
    } catch (e) {
      console.error('[updateChainKpiTotal] fetch after update failed', e && e.stack ? e.stack : e)
      return res.status(500).json({ message: 'Updated but failed to fetch KPI', error: String(e && e.message ? e.message : e) })
    }
  } catch (err) {
    console.error('[kpiController] updateChainKpiTotal error', err && err.stack ? err.stack : err);
    return res.status(500).json({ message: 'Failed to update KPI total', error: String(err && err.message ? err.message : err) });
  }
}

async function disableChainKpi(req, res) {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

    await sequelize.transaction(async (t) => {
      await sequelize.query(
        'UPDATE chain_kpis SET status = ?, updated_at = NOW(), overridden_by = ? WHERE chain_kpi_id = ? LIMIT 1',
        { replacements: ['archived', req.user.user_id, id], transaction: t }
      );
      await sequelize.query(
        'UPDATE chain_kpi_days SET is_working_day = 0, target_value = 0, kpi_current = 0, overridden_by = ?, overridden_at = NOW() WHERE chain_kpi_id = ?',
        { replacements: [req.user.user_id, id], transaction: t }
      );
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[kpiController] disableChainKpi error', err);
    return res.status(500).json({ message: 'Failed to disable KPI' });
  }
}

module.exports.updateChainKpiTotal = updateChainKpiTotal;

async function updateKpiDayWorking(req, res) {
  try {
    const id = req.params.id;
    const { date, is_working_day } = req.body;
    if (!id || !date || typeof is_working_day === 'undefined') return res.status(400).json({ message: 'Missing id, date or is_working_day' });
    if (!req.user) return res.status(403).json({ message: 'Forbidden' });

    const [[kpiRow]] = await sequelize.query('SELECT department_id FROM chain_kpis WHERE chain_kpi_id = ? LIMIT 1', { replacements: [id] });
    if (!kpiRow) return res.status(404).json({ message: 'KPI not found' });
    const deptId = kpiRow.department_id;
    if (req.user.role !== 'admin' && Number(deptId) !== Number(req.user.department_id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (is_working_day) {
      await sequelize.query(
        'UPDATE chain_kpi_days SET is_working_day = ?, overridden_by = ?, overridden_at = NOW() WHERE chain_kpi_id = ? AND date = ?',
        { replacements: [1, req.user.user_id, id, date] }
      );
    } else {
      // when marking as not working, remove the day's KPI values (set to zero)
      await sequelize.query(
        'UPDATE chain_kpi_days SET is_working_day = 0, target_value = 0, kpi_current = 0, overridden_by = ?, overridden_at = NOW() WHERE chain_kpi_id = ? AND date = ?',
        { replacements: [req.user.user_id, id, date] }
      );
    }

    const [rows] = await sequelize.query(
      'SELECT kpi_day_id, chain_kpi_id, date, target_value, is_working_day, created_by, created_at, updated_at, kpi_current, overridden_by, overridden_at FROM chain_kpi_days WHERE chain_kpi_id = ? AND date = ? LIMIT 1',
      { replacements: [id, date] }
    );

    return res.json({ day: rows && rows[0] ? rows[0] : null });
  } catch (err) {
    console.error('[kpiController] updateKpiDayWorking error', err);
    return res.status(500).json({ message: 'Failed to update working day' });
  }
}

// export the new function
module.exports.updateKpiDayWorking = updateKpiDayWorking;

async function assignWeekToEmployee(req, res) {
  try {
    console.log('[assignWeekToEmployee] payload:', { params: req.params, body: req.body, user: req.user && { user_id: req.user.user_id, role: req.user.role, department_id: req.user.department_id } })
    const chainKpiId = req.params.id
    const { employeeId, weekIndex, assignment_days } = req.body
    if (!chainKpiId || !employeeId || typeof weekIndex === 'undefined' || !assignment_days || typeof assignment_days !== 'object') {
      return res.status(400).json({ message: 'Missing parameters' })
    }
    if (!req.user) return res.status(403).json({ message: 'Forbidden' })

    // ensure KPI exists and belongs to user's department (unless admin)
    const [[kpiRow]] = await sequelize.query('SELECT department_id FROM chain_kpis WHERE chain_kpi_id = ? LIMIT 1', { replacements: [chainKpiId] })
    if (!kpiRow) return res.status(404).json({ message: 'KPI not found' })
    if (req.user.role !== 'admin' && Number(kpiRow.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    // ensure employee exists (and is in same department if not admin)
    const [empRows] = await sequelize.query('SELECT user_id, department_id FROM users WHERE user_id = ? LIMIT 1', { replacements: [employeeId] })
    if (!empRows || empRows.length === 0) return res.status(404).json({ message: 'Employee not found' })
    const emp = empRows[0]
    if (req.user.role !== 'admin' && Number(emp.department_id) !== Number(kpiRow.department_id)) {
      return res.status(403).json({ message: 'Employee not in department' })
    }

    // find week bounds
    const [weekRows] = await sequelize.query('SELECT start_date, end_date FROM chain_kpi_weeks WHERE chain_kpi_id = ? AND week_index = ? LIMIT 1', { replacements: [chainKpiId, weekIndex] })
    if (!weekRows || weekRows.length === 0) return res.status(400).json({ message: 'Week not found' })
    const week = weekRows[0]
    // normalize week bounds to date-only (YYYY-MM-DD) to avoid time portion mismatches
    const weekStart = String(week.start_date || '').split(' ')[0]
    const weekEnd = String(week.end_date || '').split(' ')[0]

    // prepare entries (absolute assigned_kpi values; allow zero for update-to-zero)
    const entries = []
    for (const [dateKey, rawVal] of Object.entries(assignment_days)) {
      const val = Number(rawVal) || 0
      if (val < 0) return res.status(400).json({ message: `Giá trị KPI không hợp lệ tại ${dateKey}` })
      const dateOnly = String(dateKey).split('T')[0]
      // ensure day exists
      const [dayRows] = await sequelize.query('SELECT kpi_day_id, target_value, kpi_current FROM chain_kpi_days WHERE chain_kpi_id = ? AND date = ? LIMIT 1', { replacements: [chainKpiId, dateOnly] })
      if (!dayRows || dayRows.length === 0) return res.status(400).json({ message: `Invalid date ${dateOnly}` })
      const day = dayRows[0]
      if (dateOnly < weekStart || dateOnly > weekEnd) {
        console.warn('[assignWeekToEmployee] date outside week bounds, continuing', { dateOnly, weekStart, weekEnd })
        // allow assignments outside the stored week bounds (frontend controls UX)
      }
      entries.push({ date: dateOnly, value: val, kpi_day_id: day.kpi_day_id, target_value: Number(day.target_value) || 0, kpi_current: Number(day.kpi_current) || 0 })
    }

    if (entries.length === 0) return res.status(400).json({ message: 'No valid assignment days' })

    const lockedStatuses = new Set(['doing', 'in_progress', 'review', 'approving', 'in_review', 'completed'])

    await sequelize.transaction(async (t) => {
      for (const e of entries) {
        const [assignedRows] = await sequelize.query(
          'SELECT COALESCE(SUM(assigned_kpi),0) as sumAssigned, COALESCE(SUM(IF(assignee_user_id = ?, assigned_kpi, 0)),0) as selfAssigned FROM chain_kpi_daily_tasks WHERE chain_kpi_id = ? AND kpi_day_id = ?',
          { replacements: [employeeId, chainKpiId, e.kpi_day_id], transaction: t }
        )
        const sumAssigned = assignedRows && assignedRows[0] ? Number(assignedRows[0].sumAssigned) : 0
        const selfAssigned = assignedRows && assignedRows[0] ? Number(assignedRows[0].selfAssigned) : 0
        const remaining = Math.max(0, e.target_value - e.kpi_current - (sumAssigned - selfAssigned))
        console.log('[assignWeekToEmployee] checking day', e.date, { sumAssigned, selfAssigned, remaining, value: e.value })
        if (e.value > remaining) throw { status: 409, message: `Assigned ${e.value} exceeds remaining ${remaining} for ${e.date}` }

        // upsert for this assignee using only assignee_user_id (no assigner_user_id required)
        const [existingRows] = await sequelize.query(
          'SELECT task_id, status, assigned_kpi FROM chain_kpi_daily_tasks WHERE chain_kpi_id = ? AND kpi_day_id = ? AND assignee_user_id = ? LIMIT 1',
          { replacements: [chainKpiId, e.kpi_day_id, employeeId], transaction: t }
        )
        console.log('[assignWeekToEmployee] existing task check:', { chainKpiId, kpi_day_id: e.kpi_day_id, employeeId, found: existingRows && existingRows.length > 0 })
        if (existingRows && existingRows.length > 0) {
          const taskId = existingRows[0].task_id
          const currentStatus = String(existingRows[0].status || '').toLowerCase().trim()
          if (lockedStatuses.has(currentStatus)) {
            throw { status: 409, message: `Không thể chỉnh sửa KPI ngày ${e.date} vì nhân viên đã nhận xử lý` }
          }
          console.log('[assignWeekToEmployee] UPDATE task', taskId, 'with assigned_kpi=', e.value)
          await sequelize.query('UPDATE chain_kpi_daily_tasks SET assigned_kpi = ?, updated_at = NOW() WHERE task_id = ?', { replacements: [e.value, taskId], transaction: t })
        } else {
          if (e.value === 0) {
            continue
          }
          const title = `Phân công bởi ${req.user.user_id}`
          console.log('[assignWeekToEmployee] INSERT new task:', { chainKpiId, kpi_day_id: e.kpi_day_id, assignee_user_id: employeeId, date: e.date, assigned_kpi: e.value })
          await sequelize.query('INSERT INTO chain_kpi_daily_tasks (chain_kpi_id, kpi_day_id, assignee_user_id, date, title, assigned_kpi, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())', { replacements: [chainKpiId, e.kpi_day_id, employeeId, e.date, title, e.value, 'not_completed', req.user.user_id], transaction: t })
        }
      }
    })

    // return updated per-day assigned totals for the week so frontend can refresh remaining values
    try {
      // Prefer returning totals for the exact dates we processed (handles cases where frontend weekIndex or week bounds differ)
      const dates = entries.map(e => e.date)
      if (dates.length > 0) {
        const placeholders = dates.map(() => '?').join(',')
        const replacements = [chainKpiId, ...dates]
        const sql = `SELECT date, COALESCE(SUM(assigned_kpi),0) as totalAssigned FROM chain_kpi_daily_tasks WHERE chain_kpi_id = ? AND date IN (${placeholders}) GROUP BY date ORDER BY date`
        const [updatedTotalsRows] = await sequelize.query(sql, { replacements })
        return res.json({ success: true, message: 'Phân công KPI thành công', updatedDays: updatedTotalsRows })
      }
      // fallback to week-range totals if no specific dates (shouldn't happen)
      const [updatedTotalsRows] = await sequelize.query(
        'SELECT date, COALESCE(SUM(assigned_kpi),0) as totalAssigned FROM chain_kpi_daily_tasks WHERE chain_kpi_id = ? AND date BETWEEN ? AND ? GROUP BY date ORDER BY date',
        { replacements: [chainKpiId, weekStart, weekEnd] }
      )
      return res.json({ success: true, message: 'Phân công KPI thành công', updatedDays: updatedTotalsRows })
    } catch (e) {
      console.warn('[assignWeekToEmployee] failed to fetch updated totals after assign', e)
      return res.json({ success: true, message: 'Phân công KPI thành công' })
    }
  } catch (err) {
    if (err && err.status) return res.status(err.status).json({ message: err.message })
    console.error('[kpiController] assignWeekToEmployee error', err)
    return res.status(500).json({ message: 'Failed to assign KPI' })
  }
}

module.exports.assignWeekToEmployee = assignWeekToEmployee;

// Transfer selected completed KPI days from source department KPI to a target department KPI.
// This creates a new chain_kpis record for the target department and copies only selected days' target values.
async function transferKpiToDepartment(req, res) {
  try {
    const sourceKpiId = Number(req.params.id)
    const targetDepartmentId = Number(req.body?.targetDepartmentId)
    const targetKpiIdInput = Number(req.body?.targetKpiId)
    const forceCreate = !!req.body?.forceCreate
    const datesRaw = Array.isArray(req.body?.dates) ? req.body.dates : []

    if (!req.user) return res.status(403).json({ message: 'Forbidden' })
    if (!Number.isFinite(sourceKpiId) || !Number.isFinite(targetDepartmentId)) {
      return res.status(400).json({ message: 'Thiếu source KPI hoặc phòng ban đích' })
    }

    const dates = [...new Set(datesRaw.map((d) => String(d || '').slice(0, 10)).filter(Boolean))]
    if (!forceCreate && dates.length === 0) {
      return res.status(400).json({ message: 'Không có ngày điều phối hợp lệ' })
    }

    const [[sourceKpi]] = await sequelize.query(
      `SELECT chain_kpi_id, department_id,
              DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
              DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
              description, kpi_name, status
       FROM chain_kpis WHERE chain_kpi_id = ? LIMIT 1`,
      { replacements: [sourceKpiId] }
    )
    if (!sourceKpi) return res.status(404).json({ message: 'KPI nguồn không tồn tại' })

    if (req.user.role !== 'admin' && Number(sourceKpi.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    if (Number(sourceKpi.department_id) === Number(targetDepartmentId)) {
      return res.status(400).json({ message: 'Phòng ban đích phải khác phòng ban nguồn' })
    }

    const [deptRows] = await sequelize.query('SELECT department_id, name FROM departments WHERE department_id = ? LIMIT 1', {
      replacements: [targetDepartmentId]
    })
    if (!deptRows || deptRows.length === 0) return res.status(404).json({ message: 'Phòng ban đích không tồn tại' })

    const dateSorted = [...dates].sort()
    const startDate = String(sourceKpi.start_date)
    const endDate = String(sourceKpi.end_date)

    const result = await sequelize.transaction(async (t) => {
      let kpiNames = null
      try {
        if (Array.isArray(sourceKpi.kpi_name)) kpiNames = sourceKpi.kpi_name
        else if (typeof sourceKpi.kpi_name === 'string') kpiNames = JSON.parse(sourceKpi.kpi_name)
      } catch (_) {
        kpiNames = null
      }

      let targetKpiId = null
      let createdNew = false
      const addedDates = []
      const preservedDates = []

      if (Number.isFinite(targetKpiIdInput) && targetKpiIdInput > 0) {
        const [targetRowsById] = await sequelize.query(
          `SELECT chain_kpi_id, department_id, transfer_source_kpi_id
           FROM chain_kpis
           WHERE chain_kpi_id = ?
           LIMIT 1`,
          { replacements: [targetKpiIdInput], transaction: t }
        )
        const targetById = targetRowsById && targetRowsById[0] ? targetRowsById[0] : null
        if (!targetById) {
          const e = new Error('KPI đích không tồn tại')
          e.status = 404
          throw e
        }
        if (Number(targetById.department_id) !== Number(targetDepartmentId)) {
          const e = new Error('KPI đích không thuộc phòng ban nhận đã chọn')
          e.status = 400
          throw e
        }
        if (Number(targetById.transfer_source_kpi_id) !== Number(sourceKpiId)) {
          const e = new Error('KPI đích không thuộc nguồn KPI hiện tại')
          e.status = 400
          throw e
        }
        targetKpiId = Number(targetById.chain_kpi_id)
      } else if (!forceCreate) {
        const [existingTargetRows] = await sequelize.query(
          `SELECT chain_kpi_id
           FROM chain_kpis
           WHERE department_id = ? AND transfer_source_kpi_id = ?
           ORDER BY chain_kpi_id DESC
           LIMIT 1`,
          { replacements: [targetDepartmentId, sourceKpiId], transaction: t }
        )
        if (existingTargetRows && existingTargetRows.length > 0) {
          targetKpiId = Number(existingTargetRows[0].chain_kpi_id)
        }
      }

      if (!targetKpiId || forceCreate) {
        createdNew = true
        const [sourceAllDays] = await sequelize.query(
          `SELECT DATE_FORMAT(date, '%Y-%m-%d') as date, target_value, is_working_day
           FROM chain_kpi_days
           WHERE chain_kpi_id = ?
           ORDER BY date`,
          { replacements: [sourceKpiId], transaction: t }
        )
        const created = await ChainKpi.create({
          created_by: req.user.user_id,
          start_date: startDate,
          end_date: endDate,
          description: sourceKpi.description ?? null,
          kpi_name: kpiNames,
          department_id: targetDepartmentId,
          transfer_source_kpi_id: sourceKpiId,
          total_kpi: 0,
          workdays_count: 0,
          status: sourceKpi.status || 'draft'
        }, { transaction: t })
        targetKpiId = created.chain_kpi_id

        const allDays = (Array.isArray(sourceAllDays) ? sourceAllDays : []).map((d) => {
          return {
            date: String(d.date),
            target_value: 0,
            is_working_day: 0
          }
        })

        for (const d of allDays) {
          await sequelize.query(
            `INSERT INTO chain_kpi_days (chain_kpi_id, date, target_value, is_working_day, created_by, created_at, updated_at, kpi_current)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW(), 0)`,
            { replacements: [targetKpiId, d.date, d.target_value, d.is_working_day, req.user.user_id], transaction: t }
          )
        }

        const weeksMap = new Map()
        for (let i = 0; i < allDays.length; i++) {
          const d = allDays[i]
          const weekIndex = Math.floor(i / 7)
          const key = String(weekIndex)
          const prev = weeksMap.get(key) || { start: d.date, end: d.date, sum: 0 }
          if (String(d.date) < String(prev.start)) prev.start = d.date
          if (String(d.date) > String(prev.end)) prev.end = d.date
          prev.sum += Number(d.target_value) || 0
          weeksMap.set(key, prev)
        }

        for (const [weekIndex, info] of weeksMap.entries()) {
          await sequelize.query(
            `INSERT INTO chain_kpi_weeks (chain_kpi_id, week_index, start_date, end_date, total_target_value, kpi_total, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            {
              replacements: [
                targetKpiId,
                Number(weekIndex),
                String(info.start) + ' 00:00:00',
                String(info.end) + ' 23:59:59',
                info.sum,
                info.sum
              ],
              transaction: t
            }
          )
        }
      }

      if (dateSorted.length > 0) {
        const placeholders = dateSorted.map(() => '?').join(',')
        const [sourceDays] = await sequelize.query(
          `SELECT kpi_day_id,
                  DATE_FORMAT(date, '%Y-%m-%d') as date,
                  target_value, is_working_day, kpi_current
           FROM chain_kpi_days
           WHERE chain_kpi_id = ? AND date IN (${placeholders})
           ORDER BY date`,
          { replacements: [sourceKpiId, ...dateSorted], transaction: t }
        )

        if (!sourceDays || sourceDays.length !== dateSorted.length) {
          const e = new Error('Một số ngày điều phối không hợp lệ')
          e.status = 400
          throw e
        }

        for (const d of sourceDays) {
          const incoming = Number(d.target_value) || 0
          if (incoming <= 0) {
            const e = new Error(`Ngày ${d.date} không có KPI để điều phối`)
            e.status = 400
            throw e
          }

          const done = Number(d.kpi_current) || 0
          if (done < incoming) {
            const e = new Error(`Ngày ${d.date} chưa hoàn thành KPI (${done}/${incoming}) nên không thể chuyển giao`)
            e.status = 400
            throw e
          }
        }

        const placeholders2 = dateSorted.map(() => '?').join(',')
        const [targetDayRows] = await sequelize.query(
          `SELECT kpi_day_id,
                  DATE_FORMAT(date, '%Y-%m-%d') as date,
                  target_value, is_working_day
           FROM chain_kpi_days
           WHERE chain_kpi_id = ? AND date IN (${placeholders2})`,
          { replacements: [targetKpiId, ...dateSorted], transaction: t }
        )
        const targetDayMap = new Map((Array.isArray(targetDayRows) ? targetDayRows : []).map((d) => [String(d.date), d]))

        for (const d of sourceDays) {
          const dateKey = String(d.date)
          const incomingTarget = Number(d.target_value) || 0
          const incomingWorking = Number(d.is_working_day) || 0
          const existing = targetDayMap.get(dateKey)

          if (!existing) {
            await sequelize.query(
              `INSERT INTO chain_kpi_days (chain_kpi_id, date, target_value, is_working_day, created_by, created_at, updated_at, kpi_current)
               VALUES (?, ?, ?, ?, ?, NOW(), NOW(), 0)`,
              { replacements: [targetKpiId, dateKey, incomingTarget, incomingWorking, req.user.user_id], transaction: t }
            )
            addedDates.push(dateKey)
            continue
          }

          const currentTarget = Number(existing.target_value) || 0
          if (currentTarget > 0) {
            preservedDates.push(dateKey)
            continue
          }

          await sequelize.query(
            `UPDATE chain_kpi_days
             SET target_value = ?, is_working_day = ?, updated_at = NOW()
             WHERE kpi_day_id = ?`,
            { replacements: [incomingTarget, incomingWorking, existing.kpi_day_id], transaction: t }
          )
          addedDates.push(dateKey)
        }
      }

      const [[finalTotalRow]] = await sequelize.query(
        `SELECT COALESCE(SUM(target_value),0) as total_kpi,
                COALESCE(SUM(CASE WHEN target_value > 0 THEN 1 ELSE 0 END),0) as workdays_count
         FROM chain_kpi_days
         WHERE chain_kpi_id = ?`,
        { replacements: [targetKpiId], transaction: t }
      )

      await sequelize.query(
        `UPDATE chain_kpis
         SET total_kpi = ?, workdays_count = ?, updated_at = NOW()
         WHERE chain_kpi_id = ?`,
        {
          replacements: [Number(finalTotalRow?.total_kpi || 0), Number(finalTotalRow?.workdays_count || 0), targetKpiId],
          transaction: t
        }
      )

      const [targetWeeks] = await sequelize.query(
        `SELECT chain_kpi_week_id, start_date, end_date
         FROM chain_kpi_weeks
         WHERE chain_kpi_id = ?
         ORDER BY week_index`,
        { replacements: [targetKpiId], transaction: t }
      )

      for (const w of (Array.isArray(targetWeeks) ? targetWeeks : [])) {
        const [[sumRow]] = await sequelize.query(
          `SELECT COALESCE(SUM(target_value),0) as total
           FROM chain_kpi_days
           WHERE chain_kpi_id = ? AND date BETWEEN ? AND ?`,
          {
            replacements: [
              targetKpiId,
              String(w.start_date || '').split(' ')[0],
              String(w.end_date || '').split(' ')[0]
            ],
            transaction: t
          }
        )
        const weekTotal = Number(sumRow?.total || 0)
        await sequelize.query(
          `UPDATE chain_kpi_weeks
           SET total_target_value = ?, kpi_total = ?, updated_at = NOW()
           WHERE chain_kpi_week_id = ?`,
          { replacements: [weekTotal, weekTotal, w.chain_kpi_week_id], transaction: t }
        )
      }

      return {
        mode: createdNew ? 'created' : 'updated',
        createdNew,
        sourceKpiId,
        targetDepartmentId,
        targetKpiId,
        transferredDates: dateSorted,
        addedDates,
        preservedDates,
        transferredDays: addedDates.length,
        transferredTotalKpi: Number(finalTotalRow?.total_kpi || 0),
        targetDepartmentName: deptRows[0].name || null
      }
    })

    return res.status(result?.createdNew ? 201 : 200).json({ ok: true, transfer: result })
  } catch (err) {
    if (err && err.status) return res.status(err.status).json({ message: err.message })
    console.error('[kpiController] transferKpiToDepartment error', err)
    return res.status(500).json({ message: 'Failed to transfer KPI to department' })
  }
}

module.exports.transferKpiToDepartment = transferKpiToDepartment;

async function listTransferHistoryByDepartment(req, res) {
  try {
    if (!req.user) return res.status(403).json({ message: 'Forbidden' })

    const requestedDeptId = req.query.department_id ? Number(req.query.department_id) : null
    const sourceDepartmentId = Number.isFinite(requestedDeptId) && requestedDeptId > 0
      ? requestedDeptId
      : Number(req.user.department_id || 0)

    if (!Number.isFinite(sourceDepartmentId) || sourceDepartmentId <= 0) {
      return res.status(400).json({ message: 'Thiếu phòng ban nguồn' })
    }

    if (req.user.role !== 'admin' && Number(sourceDepartmentId) !== Number(req.user.department_id)) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const [rows] = await sequelize.query(
      `SELECT
          target.chain_kpi_id AS target_kpi_id,
          target.transfer_source_kpi_id AS source_kpi_id,
          DATE_FORMAT(target.start_date, '%Y-%m-%d') AS start_date,
          DATE_FORMAT(target.end_date, '%Y-%m-%d') AS end_date,
          target.kpi_name,
          target.description,
          target.total_kpi,
          target.workdays_count,
          target.status,
          target.created_at,
          target.updated_at,
          target.department_id AS target_department_id,
          td.name AS target_department_name,
          source.kpi_name AS source_kpi_name,
          source.description AS source_description
       FROM chain_kpis target
       INNER JOIN chain_kpis source ON source.chain_kpi_id = target.transfer_source_kpi_id
       LEFT JOIN departments td ON td.department_id = target.department_id
       WHERE source.department_id = ?
       ORDER BY target.updated_at DESC, target.chain_kpi_id DESC`,
      { replacements: [sourceDepartmentId] }
    )

    return res.json(Array.isArray(rows) ? rows : [])
  } catch (err) {
    console.error('[kpiController] listTransferHistoryByDepartment error', err)
    return res.status(500).json({ message: 'Failed to list transfer history' })
  }
}

module.exports.listTransferHistoryByDepartment = listTransferHistoryByDepartment;

// Trả về danh sách phân công (chain_kpi_daily_tasks) cho một KPI
// Nếu cung cấp `weekIndex` trong query, giới hạn theo tuần tương ứng
async function getAssignmentsForKpi(req, res) {
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ message: 'Missing id' })
    if (!req.user) return res.status(403).json({ message: 'Forbidden' })

    // ensure KPI exists and check department permission
    const [[kpiRow]] = await sequelize.query('SELECT department_id, transfer_source_kpi_id FROM chain_kpis WHERE chain_kpi_id = ? LIMIT 1', { replacements: [id] })
    if (!kpiRow) return res.status(404).json({ message: 'KPI not found' })
    if (req.user.role !== 'admin' && Number(kpiRow.department_id) !== Number(req.user.department_id)) {
      let canAccessByTransfer = false

      const sourceId = Number(kpiRow.transfer_source_kpi_id || 0)
      if (sourceId > 0) {
        const [[sourceRow]] = await sequelize.query(
          'SELECT department_id FROM chain_kpis WHERE chain_kpi_id = ? LIMIT 1',
          { replacements: [sourceId] }
        )
        canAccessByTransfer = Number(sourceRow?.department_id || 0) === Number(req.user.department_id)
      }

      if (!canAccessByTransfer) {
        const [targetRows] = await sequelize.query(
          'SELECT chain_kpi_id FROM chain_kpis WHERE transfer_source_kpi_id = ? AND department_id = ? LIMIT 1',
          { replacements: [id, req.user.department_id] }
        )
        canAccessByTransfer = Array.isArray(targetRows) && targetRows.length > 0
      }

      if (!canAccessByTransfer) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    }

    let rows = []
    const weekIndex = typeof req.query.weekIndex !== 'undefined' ? Number(req.query.weekIndex) : null
    const assignedTo = typeof req.query.assigned_to !== 'undefined' ? (Number(req.query.assigned_to) || null) : null
    if (weekIndex !== null && !Number.isNaN(weekIndex)) {
      const [weekRows] = await sequelize.query('SELECT start_date, end_date FROM chain_kpi_weeks WHERE chain_kpi_id = ? AND week_index = ? LIMIT 1', { replacements: [id, weekIndex] })
      if (weekRows && weekRows.length > 0) {
        const week = weekRows[0]
        const startRaw = String(week.start_date || '')
        const endRaw = String(week.end_date || '')
        const start = startRaw.split(' ')[0] || startRaw
        const end = endRaw.split(' ')[0] || endRaw
        console.log('[getAssignmentsForKpi] week found', { weekIndex, startRaw, endRaw, start, end })
        let r
        if (assignedTo) {
          const q = 'SELECT task_id, chain_kpi_id, kpi_day_id, assignee_user_id, date, assigned_kpi, title, status, created_by, created_at, updated_at FROM chain_kpi_daily_tasks WHERE chain_kpi_id = ? AND date BETWEEN ? AND ? AND assignee_user_id = ? ORDER BY date'
          const resQ = await sequelize.query(q, { replacements: [id, start, end, assignedTo] })
          r = resQ[0]
        } else {
          const resQ = await sequelize.query('SELECT task_id, chain_kpi_id, kpi_day_id, assignee_user_id, date, assigned_kpi, title, status, created_by, created_at, updated_at FROM chain_kpi_daily_tasks WHERE chain_kpi_id = ? AND date BETWEEN ? AND ? ORDER BY date', { replacements: [id, start, end] })
          r = resQ[0]
        }
        console.log('[getAssignmentsForKpi] query result', { count: r ? r.length : 0 })
        rows = r
      } else {
        console.log('[getAssignmentsForKpi] week not found', { weekIndex })
        // week not found -> return empty
        rows = []
      }
    } else {
      if (assignedTo) {
        const resQ = await sequelize.query('SELECT task_id, chain_kpi_id, kpi_day_id, assignee_user_id, date, assigned_kpi, title, status, created_by, created_at, updated_at FROM chain_kpi_daily_tasks WHERE chain_kpi_id = ? AND assignee_user_id = ? ORDER BY date', { replacements: [id, assignedTo] })
        rows = resQ[0]
      } else {
        const resQ = await sequelize.query('SELECT task_id, chain_kpi_id, kpi_day_id, assignee_user_id, date, assigned_kpi, title, status, created_by, created_at, updated_at FROM chain_kpi_daily_tasks WHERE chain_kpi_id = ? ORDER BY date', { replacements: [id] })
        rows = resQ[0]
      }
    }

    return res.json(rows)
  } catch (err) {
    console.error('[kpiController] getAssignmentsForKpi error', err)
    return res.status(500).json({ message: 'Failed to fetch assignments' })
  }
}

module.exports.getAssignmentsForKpi = getAssignmentsForKpi;

// Update status of a specific assignment (chain_kpi_daily_tasks.task_id)
async function updateAssignmentStatus(req, res) {
  try {
    const id = req.params.id // chain_kpi_id
    const taskId = req.params.taskId
    const { status: newStatus } = req.body
    if (!id || !taskId || !newStatus) return res.status(400).json({ message: 'Missing parameters' })
    if (!req.user) return res.status(403).json({ message: 'Forbidden' })

    // ensure KPI exists and permission
    const [[kpiRow]] = await sequelize.query('SELECT department_id FROM chain_kpis WHERE chain_kpi_id = ? LIMIT 1', { replacements: [id] })
    if (!kpiRow) return res.status(404).json({ message: 'KPI not found' })
    if (req.user.role !== 'admin' && Number(kpiRow.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    // ensure task exists and belongs to this KPI
    const [taskRows] = await sequelize.query('SELECT task_id, assignee_user_id, status, date, assigned_kpi FROM chain_kpi_daily_tasks WHERE task_id = ? AND chain_kpi_id = ? LIMIT 1', { replacements: [taskId, id] })
    if (!taskRows || taskRows.length === 0) return res.status(404).json({ message: 'Assignment not found' })
    const task = taskRows[0]

    // Map frontend-only statuses to DB statuses (DB enum: 'not_completed','doing','review','completed')
    let dbStatus = newStatus
    if (newStatus === 'doing') dbStatus = 'doing'
    if (newStatus === 'not_completed') dbStatus = 'not_completed'
    // validate allowed statuses
    const allowed = ['not_completed', 'doing', 'review', 'completed']
    if (!allowed.includes(dbStatus)) return res.status(400).json({ message: 'Invalid status' })

    // If moving to review, ensure outputs exist and create approval record
    if (dbStatus === 'review') {
      const [albums] = await sequelize.query(
        'SELECT album_id, task_id, album_index, album_name, created_by, created_at FROM kpi_output_albums WHERE task_id = ? ORDER BY album_index',
        { replacements: [taskId] }
      )
      const albumIds = (albums || []).map(a => a.album_id)
      const [items] = albumIds.length > 0
        ? await sequelize.query(
            `SELECT output_id, album_id, item_type, url_or_path, preview_url, created_by, created_at
             FROM kpi_output_items WHERE album_id IN (${albumIds.map(() => '?').join(',')})`,
            { replacements: albumIds }
          )
        : [[], null]
      const outputIds = (items || []).map(i => i.output_id)
      const [files] = outputIds.length > 0
        ? await sequelize.query(
            `SELECT file_id, output_id, file_url, file_type, created_by, created_at
             FROM kpi_output_files WHERE output_id IN (${outputIds.map(() => '?').join(',')})`,
            { replacements: outputIds }
          )
        : [[], null]
      const [links] = albumIds.length > 0
        ? await sequelize.query(
            `SELECT link_id, album_id, url, created_by, created_at
             FROM kpi_output_links WHERE album_id IN (${albumIds.map(() => '?').join(',')})`,
            { replacements: albumIds }
          )
        : [[], null]

      const hasOutputs = (items && items.length > 0) || (links && links.length > 0) || (files && files.length > 0)
      if (!hasOutputs) {
        return res.status(400).json({ message: 'Vui lòng upload kết quả trước khi gửi phê duyệt.' })
      }

      const snapshot = JSON.stringify({ albums, items, files, links })
      await sequelize.query(
        `INSERT INTO kpi_approvals (task_id, chain_kpi_id, assignee_user_id, date, assigned_kpi, status, submitted_by, submitted_at, outputs_snapshot)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW(), ?)
         ON DUPLICATE KEY UPDATE
           chain_kpi_id = VALUES(chain_kpi_id),
           assignee_user_id = VALUES(assignee_user_id),
           date = VALUES(date),
           assigned_kpi = VALUES(assigned_kpi),
           status = 'pending',
           submitted_by = VALUES(submitted_by),
           submitted_at = NOW(),
           reviewed_by = NULL,
           reviewed_at = NULL,
           reject_reason = NULL,
           outputs_snapshot = VALUES(outputs_snapshot)`,
        { replacements: [taskId, id, task.assignee_user_id, task.date, task.assigned_kpi || 0, req.user.user_id, snapshot] }
      )
    }

    await sequelize.query('UPDATE chain_kpi_daily_tasks SET status = ?, updated_at = NOW() WHERE task_id = ? AND chain_kpi_id = ?', { replacements: [dbStatus, taskId, id] })

    // After updating this assignment, if ALL assignments for the same KPI day are completed,
    // mark the corresponding chain_kpi_days.kpi_current = target_value and record who overrode it.
    let dayUpdated = null
    try {
      const [incompleteCountRows] = await sequelize.query(
        'SELECT COUNT(*) as cnt FROM chain_kpi_daily_tasks WHERE chain_kpi_id = ? AND date = ? AND status != ? LIMIT 1',
        { replacements: [id, task.date, 'completed'] }
      )
      const incompleteCount = (incompleteCountRows && incompleteCountRows[0] && Number(incompleteCountRows[0].cnt)) || 0
      if (incompleteCount === 0) {
        const [dayRows] = await sequelize.query('SELECT kpi_day_id, target_value FROM chain_kpi_days WHERE chain_kpi_id = ? AND date = ? LIMIT 1', { replacements: [id, task.date] })
        if (dayRows && dayRows.length > 0) {
          const day = dayRows[0]
          const newVal = Number(day.target_value) || 0
          await sequelize.query('UPDATE chain_kpi_days SET kpi_current = ?, overridden_by = ?, overridden_at = NOW() WHERE kpi_day_id = ?', { replacements: [newVal, req.user.user_id, day.kpi_day_id] })
          // read back the updated day row to return to clients
          const [fresh] = await sequelize.query('SELECT kpi_day_id, chain_kpi_id, date, target_value, kpi_current, overridden_by, overridden_at FROM chain_kpi_days WHERE kpi_day_id = ? LIMIT 1', { replacements: [day.kpi_day_id] })
          dayUpdated = (fresh && fresh[0]) ? fresh[0] : null
          // optional: log the automatic day-completion
          console.log('[kpiController] mark day completed automatically', { chain_kpi_id: id, date: task.date, by: req.user.user_id, kpi_current: newVal })
        }
      }
    } catch (err) {
      console.error('[kpiController] auto-mark day completed error', err)
    }

    const [updatedRows] = await sequelize.query('SELECT task_id, chain_kpi_id, kpi_day_id, assignee_user_id, date, assigned_kpi, title, status, created_by, created_at, updated_at FROM chain_kpi_daily_tasks WHERE task_id = ? LIMIT 1', { replacements: [taskId] })
    return res.json({ task: updatedRows && updatedRows[0] ? updatedRows[0] : null, dayUpdated })
  } catch (err) {
    console.error('[kpiController] updateAssignmentStatus error', err)
    return res.status(500).json({ message: 'Failed to update assignment status' })
  }
}

module.exports.updateAssignmentStatus = updateAssignmentStatus;

// Upload KPI outputs (albums -> items/files/links)
async function uploadKpiOutputs(req, res) {
  try {
    const id = req.params.id
    const taskId = req.params.taskId
    if (!id || !taskId) return res.status(400).json({ message: 'Missing id or taskId' })
    if (!req.user) return res.status(403).json({ message: 'Forbidden' })

    let payload = {}
    try {
      payload = req.body && req.body.payload ? JSON.parse(req.body.payload) : {}
    } catch (err) {
      return res.status(400).json({ message: 'Invalid payload' })
    }

    const albums = Array.isArray(payload.albums) ? payload.albums : []

    // verify task and permissions
    const [taskRows] = await sequelize.query(
      'SELECT task_id, chain_kpi_id, assignee_user_id, assigned_kpi FROM chain_kpi_daily_tasks WHERE task_id = ? AND chain_kpi_id = ? LIMIT 1',
      { replacements: [taskId, id] }
    )
    if (!taskRows || taskRows.length === 0) return res.status(404).json({ message: 'Assignment not found' })
    const task = taskRows[0]
    const [[kpiRow]] = await sequelize.query(
      'SELECT department_id FROM chain_kpis WHERE chain_kpi_id = ? LIMIT 1',
      { replacements: [id] }
    )
    const role = String(req.user.role || '').toLowerCase()
    const isAdmin = role === 'admin'
    const isLeader = role === 'leader' || role === 'manager' || role === 'head'
    const sameDept = kpiRow && Number(kpiRow.department_id) === Number(req.user.department_id)

    if (!isAdmin && Number(task.assignee_user_id) !== Number(req.user.user_id)) {
      if (!(isLeader && sameDept)) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    }

    const maxAlbums = Number(task.assigned_kpi) || 0
    if (maxAlbums > 0 && albums.length > maxAlbums) {
      return res.status(400).json({ message: 'Album count exceeds KPI count' })
    }

    const files = Array.isArray(req.files) ? req.files : []
    const filesByAlbum = new Map()
    for (const f of files) {
      const match = String(f.fieldname || '').match(/^files_(\d+)$/)
      if (!match) continue
      const idx = Number(match[1])
      if (Number.isNaN(idx)) continue
      const albumIndex = idx + 1
      if (!filesByAlbum.has(albumIndex)) filesByAlbum.set(albumIndex, [])
      filesByAlbum.get(albumIndex).push(f)
    }

    const created = { albums: 0, items: 0, files: 0, links: 0 }

    await sequelize.transaction(async (t) => {
      for (let i = 0; i < albums.length; i += 1) {
        const album = albums[i] || {}
        const albumIndex = Number(album.albumIndex) || (i + 1)
        let albumId = Number(album.albumId) || null

        if (albumId) {
          const [existRows] = await sequelize.query(
            'SELECT album_id FROM kpi_output_albums WHERE album_id = ? AND task_id = ? LIMIT 1',
            { replacements: [albumId, taskId], transaction: t }
          )
          if (!existRows || existRows.length === 0) {
            throw new Error('Album not found for this task')
          }
        } else {
          const [albumRes] = await sequelize.query(
            'INSERT INTO kpi_output_albums (task_id, album_index, album_name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
            { replacements: [taskId, albumIndex, album.albumName || null, req.user.user_id], transaction: t }
          )
          albumId = albumRes && albumRes.insertId ? albumRes.insertId : null
          if (!albumId) {
            const [idRows] = await sequelize.query('SELECT LAST_INSERT_ID() as id', { transaction: t })
            albumId = idRows && idRows[0] ? idRows[0].id : null
          }
          if (!albumId) {
            throw new Error('Failed to create output album')
          }
          created.albums += 1
        }

        const albumFiles = filesByAlbum.get(albumIndex) || []
        for (const f of albumFiles) {
          const publicPath = `/uploads/kpi/outputs/task-${taskId}/${f.filename}`
          const isImage = /^image\//i.test(f.mimetype || '')
          const itemType = isImage ? 'image' : 'file'

          const [itemRes] = await sequelize.query(
            'INSERT INTO kpi_output_items (album_id, item_type, url_or_path, preview_url, created_by, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            { replacements: [albumId, itemType, publicPath, isImage ? publicPath : null, req.user.user_id], transaction: t }
          )
          let outputId = itemRes && itemRes.insertId ? itemRes.insertId : null
          if (!outputId) {
            const [idRows] = await sequelize.query('SELECT LAST_INSERT_ID() as id', { transaction: t })
            outputId = idRows && idRows[0] ? idRows[0].id : null
          }
          if (!outputId) {
            throw new Error('Failed to create output item')
          }
          created.items += 1

          await sequelize.query(
            'INSERT INTO kpi_output_files (output_id, file_url, file_type, created_by, created_at) VALUES (?, ?, ?, ?, NOW())',
            { replacements: [outputId, publicPath, f.mimetype || null, req.user.user_id], transaction: t }
          )
          created.files += 1
        }

        const linkList = Array.isArray(album.links) ? album.links : []
        for (const link of linkList) {
          const clean = String(link || '').trim()
          if (!clean) continue
          await sequelize.query(
            'INSERT INTO kpi_output_links (album_id, url, created_by, created_at) VALUES (?, ?, ?, NOW())',
            { replacements: [albumId, clean, req.user.user_id], transaction: t }
          )
          created.links += 1
        }
      }
    })

    return res.json({ ok: true, created })
  } catch (err) {
    console.error('[kpiController] uploadKpiOutputs error', err)
    return res.status(500).json({ message: 'Failed to upload KPI outputs' })
  }
}

module.exports.uploadKpiOutputs = uploadKpiOutputs;

// Get KPI outputs for a task
async function getKpiOutputs(req, res) {
  try {
    const id = req.params.id
    const taskId = req.params.taskId
    if (!id || !taskId) return res.status(400).json({ message: 'Missing id or taskId' })
    if (!req.user) return res.status(403).json({ message: 'Forbidden' })

    const [taskRows] = await sequelize.query(
      'SELECT task_id, chain_kpi_id, assignee_user_id, assigned_kpi FROM chain_kpi_daily_tasks WHERE task_id = ? AND chain_kpi_id = ? LIMIT 1',
      { replacements: [taskId, id] }
    )
    if (!taskRows || taskRows.length === 0) return res.status(404).json({ message: 'Assignment not found' })
    const task = taskRows[0]
    const [[kpiRow]] = await sequelize.query(
      'SELECT department_id, transfer_source_kpi_id FROM chain_kpis WHERE chain_kpi_id = ? LIMIT 1',
      { replacements: [id] }
    )
    const role = String(req.user.role || '').toLowerCase()
    const isAdmin = role === 'admin'
    const isLeader = role === 'leader' || role === 'manager' || role === 'head'
    const sameDept = kpiRow && Number(kpiRow.department_id) === Number(req.user.department_id)
    let canAccessByTransfer = false
    if (!sameDept) {
      const sourceId = Number(kpiRow?.transfer_source_kpi_id || 0)
      if (sourceId > 0) {
        const [[sourceRow]] = await sequelize.query(
          'SELECT department_id FROM chain_kpis WHERE chain_kpi_id = ? LIMIT 1',
          { replacements: [sourceId] }
        )
        canAccessByTransfer = Number(sourceRow?.department_id || 0) === Number(req.user.department_id)
      }
      if (!canAccessByTransfer) {
        const [targetRows] = await sequelize.query(
          'SELECT chain_kpi_id FROM chain_kpis WHERE transfer_source_kpi_id = ? AND department_id = ? LIMIT 1',
          { replacements: [id, req.user.department_id] }
        )
        canAccessByTransfer = Array.isArray(targetRows) && targetRows.length > 0
      }
    }

    if (!isAdmin && Number(task.assignee_user_id) !== Number(req.user.user_id)) {
      if (!(isLeader && (sameDept || canAccessByTransfer))) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    }

    const [albums] = await sequelize.query(
      'SELECT album_id, task_id, album_index, album_name, created_by, created_at FROM kpi_output_albums WHERE task_id = ? ORDER BY album_index',
      { replacements: [taskId] }
    )

    if (!albums || albums.length === 0) {
      return res.json({ albums: [], assigned_kpi: Number(task.assigned_kpi) || 0 })
    }

    const albumIds = albums.map(a => a.album_id)
    const [items] = await sequelize.query(
      `SELECT output_id, album_id, item_type, url_or_path, preview_url, created_by, created_at
       FROM kpi_output_items WHERE album_id IN (${albumIds.map(() => '?').join(',')})`,
      { replacements: albumIds }
    )
    const outputIds = items.map(i => i.output_id)
    const [files] = outputIds.length > 0
      ? await sequelize.query(
          `SELECT file_id, output_id, file_url, file_type, created_by, created_at
           FROM kpi_output_files WHERE output_id IN (${outputIds.map(() => '?').join(',')})`,
          { replacements: outputIds }
        )
      : [[], null]
    const [links] = await sequelize.query(
      `SELECT link_id, album_id, url, created_by, created_at
       FROM kpi_output_links WHERE album_id IN (${albumIds.map(() => '?').join(',')})`,
      { replacements: albumIds }
    )

    return res.json({ albums, items, files, links, assigned_kpi: Number(task.assigned_kpi) || 0 })
  } catch (err) {
    console.error('[kpiController] getKpiOutputs error', err)
    return res.status(500).json({ message: 'Failed to fetch KPI outputs' })
  }
}

module.exports.getKpiOutputs = getKpiOutputs;

function safeUnlink(target) {
  const fs = require('fs')
  fs.unlink(target, (err) => {
    if (err && err.code !== 'ENOENT') console.warn('[kpiController] unlink failed', target, err.message)
  })
}

function removeUploadByUrl(urlOrPath) {
  if (!urlOrPath) return
  const path = require('path')
  const fs = require('fs')
  let relPath = urlOrPath
  try {
    const u = new URL(urlOrPath)
    relPath = u.pathname || urlOrPath
  } catch (e) {
    // not a URL
  }
  const cleaned = String(relPath).replace(/^\/+/, '')
  const rel = cleaned.startsWith('uploads/') ? cleaned.slice('uploads/'.length) : cleaned
  const uploadsRoot = path.join(__dirname, '..', 'public', 'uploads')
  const abs = path.join(uploadsRoot, rel)
  if (!abs.startsWith(uploadsRoot) || !fs.existsSync(abs)) return
  safeUnlink(abs)
}

// Delete a single output item (file/image)
async function deleteKpiOutputItem(req, res) {
  try {
    const { id, taskId, outputId } = req.params
    if (!id || !taskId || !outputId) return res.status(400).json({ message: 'Missing parameters' })
    if (!req.user) return res.status(403).json({ message: 'Forbidden' })

    const [taskRows] = await sequelize.query(
      'SELECT task_id, chain_kpi_id, assignee_user_id FROM chain_kpi_daily_tasks WHERE task_id = ? AND chain_kpi_id = ? LIMIT 1',
      { replacements: [taskId, id] }
    )
    if (!taskRows || taskRows.length === 0) return res.status(404).json({ message: 'Assignment not found' })
    const task = taskRows[0]
    if (req.user.role !== 'admin' && Number(task.assignee_user_id) !== Number(req.user.user_id)) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const [itemRows] = await sequelize.query(
      'SELECT output_id, url_or_path, preview_url FROM kpi_output_items WHERE output_id = ? LIMIT 1',
      { replacements: [outputId] }
    )
    if (!itemRows || itemRows.length === 0) return res.status(404).json({ message: 'Output not found' })
    const item = itemRows[0]

    const [fileRows] = await sequelize.query(
      'SELECT file_id, file_url FROM kpi_output_files WHERE output_id = ?',
      { replacements: [outputId] }
    )

    await sequelize.transaction(async (t) => {
      await sequelize.query('DELETE FROM kpi_output_files WHERE output_id = ?', { replacements: [outputId], transaction: t })
      await sequelize.query('DELETE FROM kpi_output_items WHERE output_id = ?', { replacements: [outputId], transaction: t })
    })

    if (Array.isArray(fileRows)) {
      fileRows.forEach((f) => removeUploadByUrl(f.file_url))
    }
    removeUploadByUrl(item.url_or_path)
    removeUploadByUrl(item.preview_url)

    return res.json({ ok: true })
  } catch (err) {
    console.error('[kpiController] deleteKpiOutputItem error', err)
    return res.status(500).json({ message: 'Failed to delete output item' })
  }
}

// Delete a single link
async function deleteKpiOutputLink(req, res) {
  try {
    const { id, taskId, linkId } = req.params
    if (!id || !taskId || !linkId) return res.status(400).json({ message: 'Missing parameters' })
    if (!req.user) return res.status(403).json({ message: 'Forbidden' })

    const [taskRows] = await sequelize.query(
      'SELECT task_id, chain_kpi_id, assignee_user_id FROM chain_kpi_daily_tasks WHERE task_id = ? AND chain_kpi_id = ? LIMIT 1',
      { replacements: [taskId, id] }
    )
    if (!taskRows || taskRows.length === 0) return res.status(404).json({ message: 'Assignment not found' })
    const task = taskRows[0]
    if (req.user.role !== 'admin' && Number(task.assignee_user_id) !== Number(req.user.user_id)) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    await sequelize.query('DELETE FROM kpi_output_links WHERE link_id = ?', { replacements: [linkId] })
    return res.json({ ok: true })
  } catch (err) {
    console.error('[kpiController] deleteKpiOutputLink error', err)
    return res.status(500).json({ message: 'Failed to delete output link' })
  }
}

module.exports.deleteKpiOutputItem = deleteKpiOutputItem;
module.exports.deleteKpiOutputLink = deleteKpiOutputLink;

// List approvals for leader/admin
async function listKpiApprovals(req, res) {
  try {
    if (!req.user) return res.status(403).json({ message: 'Forbidden' })
    const role = String(req.user.role || '').toLowerCase()
    const isAdmin = role === 'admin'
    const isLeader = role === 'leader' || role === 'manager' || role === 'head'

    const status = req.query.status ? String(req.query.status) : null
    const chainKpiId = req.query.chain_kpi_id ? Number(req.query.chain_kpi_id) : null

    let where = '1=1'
    const replacements = []
    if (status) { where += ' AND a.status = ?'; replacements.push(status) }
    if (chainKpiId) { where += ' AND a.chain_kpi_id = ?'; replacements.push(chainKpiId) }

    if (!isAdmin && !isLeader) return res.status(403).json({ message: 'Forbidden' })

    if (!isAdmin) {
      where += ' AND k.department_id = ?'
      replacements.push(Number(req.user.department_id))
    }

    const [rows] = await sequelize.query(
      `SELECT a.approval_id, a.task_id, a.chain_kpi_id, a.assignee_user_id, a.date, a.assigned_kpi, a.status,
              a.submitted_by, a.submitted_at, a.reviewed_by, a.reviewed_at, a.reject_reason, a.outputs_snapshot,
              k.kpi_name, k.description
       FROM kpi_approvals a
       JOIN chain_kpis k ON k.chain_kpi_id = a.chain_kpi_id
       WHERE ${where}
       ORDER BY a.submitted_at DESC`,
      { replacements }
    )
    return res.json(rows)
  } catch (err) {
    console.error('[kpiController] listKpiApprovals error', err)
    return res.status(500).json({ message: 'Failed to fetch approvals' })
  }
}

// Update approval status (approve/reject)
async function updateKpiApprovalStatus(req, res) {
  try {
    const approvalId = req.params.approvalId
    const { status, reason } = req.body
    if (!approvalId || !status) return res.status(400).json({ message: 'Missing parameters' })
    if (!req.user) return res.status(403).json({ message: 'Forbidden' })

    const role = String(req.user.role || '').toLowerCase()
    const isAdmin = role === 'admin'
    const isLeader = role === 'leader' || role === 'manager' || role === 'head'
    if (!isAdmin && !isLeader) return res.status(403).json({ message: 'Forbidden' })

    const [[row]] = await sequelize.query(
      'SELECT approval_id, task_id, chain_kpi_id FROM kpi_approvals WHERE approval_id = ? LIMIT 1',
      { replacements: [approvalId] }
    )
    if (!row) return res.status(404).json({ message: 'Approval not found' })

    const [[kpiRow]] = await sequelize.query(
      'SELECT department_id FROM chain_kpis WHERE chain_kpi_id = ? LIMIT 1',
      { replacements: [row.chain_kpi_id] }
    )
    if (!isAdmin && Number(kpiRow.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const normalized = String(status).toLowerCase()
    if (!['approved', 'rejected'].includes(normalized)) return res.status(400).json({ message: 'Invalid status' })

    // perform updates in a transaction and return updated approval + task
    const result = await sequelize.transaction(async (t) => {
      await sequelize.query(
        'UPDATE kpi_approvals SET status = ?, reviewed_by = ?, reviewed_at = NOW(), reject_reason = ? WHERE approval_id = ?',
        { replacements: [normalized, req.user.user_id, normalized === 'rejected' ? (reason || null) : null, approvalId], transaction: t }
      )

      // update assignment status based on approval
      const taskStatus = normalized === 'approved' ? 'completed' : 'doing'
      await sequelize.query(
        'UPDATE chain_kpi_daily_tasks SET status = ?, updated_at = NOW() WHERE task_id = ? AND chain_kpi_id = ?',
        { replacements: [taskStatus, row.task_id, row.chain_kpi_id], transaction: t }
      )

      // fetch updated approval and task
      const [[updatedApproval]] = await sequelize.query('SELECT approval_id, task_id, chain_kpi_id, assignee_user_id, date, assigned_kpi, status, submitted_by, submitted_at, reviewed_by, reviewed_at, reject_reason, outputs_snapshot FROM kpi_approvals WHERE approval_id = ? LIMIT 1', { replacements: [approvalId], transaction: t })
      const [[updatedTask]] = await sequelize.query('SELECT task_id, chain_kpi_id, kpi_day_id, assignee_user_id, date, assigned_kpi, title, status, created_by, created_at, updated_at FROM chain_kpi_daily_tasks WHERE task_id = ? LIMIT 1', { replacements: [row.task_id], transaction: t })

      // If approval resulted in the task being completed, and all other tasks for the same
      // KPI day are also completed, mark the corresponding chain_kpi_days.kpi_current = target_value
      let dayUpdated = null
      try {
        if (updatedTask && updatedTask.status === 'completed') {
          const [incompleteCountRows] = await sequelize.query(
            'SELECT COUNT(*) as cnt FROM chain_kpi_daily_tasks WHERE chain_kpi_id = ? AND date = ? AND status != ? LIMIT 1',
            { replacements: [updatedTask.chain_kpi_id, updatedTask.date, 'completed'], transaction: t }
          )
          const incompleteCount = (incompleteCountRows && incompleteCountRows[0] && Number(incompleteCountRows[0].cnt)) || 0
          if (incompleteCount === 0) {
            const [dayRows] = await sequelize.query('SELECT kpi_day_id, target_value FROM chain_kpi_days WHERE chain_kpi_id = ? AND date = ? LIMIT 1', { replacements: [updatedTask.chain_kpi_id, updatedTask.date], transaction: t })
            if (dayRows && dayRows.length > 0) {
              const day = dayRows[0]
              const newVal = Number(day.target_value) || 0
              await sequelize.query('UPDATE chain_kpi_days SET kpi_current = ?, overridden_by = ?, overridden_at = NOW() WHERE kpi_day_id = ?', { replacements: [newVal, req.user.user_id, day.kpi_day_id], transaction: t })
              const [fresh] = await sequelize.query('SELECT kpi_day_id, chain_kpi_id, date, target_value, kpi_current, overridden_by, overridden_at FROM chain_kpi_days WHERE kpi_day_id = ? LIMIT 1', { replacements: [day.kpi_day_id], transaction: t })
              dayUpdated = (fresh && fresh[0]) ? fresh[0] : null
            }
          }
        }
      } catch (err) {
        console.error('[kpiController] auto-mark day completed in approval flow error', err)
      }

      return { updatedApproval, updatedTask, dayUpdated }
    })

    return res.json({ ok: true, approval: result.updatedApproval, task: result.updatedTask, dayUpdated: result.dayUpdated || null })
  } catch (err) {
    console.error('[kpiController] updateKpiApprovalStatus error', err)
    return res.status(500).json({ message: 'Failed to update approval' })
  }
}

module.exports.listKpiApprovals = listKpiApprovals;
module.exports.updateKpiApprovalStatus = updateKpiApprovalStatus;

