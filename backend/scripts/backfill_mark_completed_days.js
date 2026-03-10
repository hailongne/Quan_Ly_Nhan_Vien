// Backfill script: mark chain_kpi_days as completed when all assignments for that day are completed.
// Usage: node scripts/backfill_mark_completed_days.js [overridden_by_user_id]

const { Sequelize } = require('sequelize');
const path = require('path');

async function main() {
  const overriddenBy = process.argv[2] ? Number(process.argv[2]) : 1;
  try {
    // load models from backend/models (assumes same project layout)
    const modelsPath = path.join(__dirname, '..', 'models');
    const { sequelize } = require(modelsPath);

    console.log('[backfill] starting, using overridden_by =', overriddenBy);

    // Find days where every assignment is completed and day.kpi_current != target_value
    const checkQuery = `
      SELECT d.kpi_day_id, d.chain_kpi_id, d.date, d.target_value,
             SUM(CASE WHEN t.status != 'completed' THEN 1 ELSE 0 END) AS incomplete_count,
             MAX(d.kpi_current) AS existing_kpi_current
      FROM chain_kpi_days d
      LEFT JOIN chain_kpi_daily_tasks t ON t.chain_kpi_id = d.chain_kpi_id AND t.date = d.date
      GROUP BY d.kpi_day_id, d.chain_kpi_id, d.date, d.target_value
      HAVING incomplete_count = 0 AND (existing_kpi_current IS NULL OR existing_kpi_current <> d.target_value)
    `;

    const [rows] = await sequelize.query(checkQuery);
    console.log('[backfill] rows to update:', rows.length);
    if (!rows || rows.length === 0) {
      console.log('[backfill] nothing to update, exiting.');
      process.exit(0);
    }

    const transaction = await sequelize.transaction();
    try {
      for (const r of rows) {
        const newVal = Number(r.target_value) || 0;
        console.log('[backfill] updating', r.kpi_day_id, r.chain_kpi_id, r.date, '=>', newVal);
        await sequelize.query(
          'UPDATE chain_kpi_days SET kpi_current = ?, overridden_by = ?, overridden_at = NOW() WHERE kpi_day_id = ?',
          { replacements: [newVal, overriddenBy, r.kpi_day_id], transaction }
        );
      }
      await transaction.commit();
      console.log('[backfill] completed successfully');
      process.exit(0);
    } catch (err) {
      await transaction.rollback();
      console.error('[backfill] transaction error', err);
      process.exit(2);
    }
  } catch (err) {
    console.error('[backfill] error', err);
    process.exit(3);
  }
}

main();
