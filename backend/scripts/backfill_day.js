const { sequelize } = require('../models');

(async () => {
  try {
    const date = process.argv[2] || '2026-02-14';
    console.log('[backfill_day] date=', date);

    const [rows] = await sequelize.query(
      `SELECT d.kpi_day_id, d.chain_kpi_id, d.date, d.target_value,
              SUM(CASE WHEN t.status != 'completed' THEN 1 ELSE 0 END) as incomplete_count
       FROM chain_kpi_days d
       LEFT JOIN chain_kpi_daily_tasks t ON t.chain_kpi_id = d.chain_kpi_id AND t.date = d.date
       WHERE d.date = ?
       GROUP BY d.kpi_day_id, d.chain_kpi_id, d.date, d.target_value
       HAVING incomplete_count = 0 AND (MAX(d.kpi_current) IS NULL OR MAX(d.kpi_current) <> d.target_value)
      `,
      { replacements: [date] }
    );

    console.log('[backfill_day] rows to update:', rows.length);
    if (!rows || rows.length === 0) {
      console.log('[backfill_day] nothing to update');
      process.exit(0);
    }

    const t = await sequelize.transaction();
    try {
      for (const r of rows) {
        const newVal = Number(r.target_value) || 0;
        console.log('[backfill_day] updating', r.kpi_day_id, r.chain_kpi_id, r.date, '=>', newVal);
        await sequelize.query('UPDATE chain_kpi_days SET kpi_current = ?, overridden_by = ?, overridden_at = NOW() WHERE kpi_day_id = ?', { replacements: [newVal, 1, r.kpi_day_id], transaction: t });
      }
      await t.commit();
      console.log('[backfill_day] committed');
      process.exit(0);
    } catch (err) {
      await t.rollback();
      console.error('[backfill_day] transaction error', err);
      process.exit(2);
    }
  } catch (err) {
    console.error('[backfill_day] error', err);
    process.exit(3);
  }
})();
