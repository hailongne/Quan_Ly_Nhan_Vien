const { sequelize } = require('../models');

(async () => {
  try {
    const date = process.argv[2] || (new Date()).toISOString().split('T')[0];
    console.log('[check_day_param] date=', date);
    const [days] = await sequelize.query(
      'SELECT kpi_day_id, chain_kpi_id, date, target_value, kpi_current, overridden_by, overridden_at FROM chain_kpi_days WHERE date = ?',
      { replacements: [date] }
    );

    const [counts] = await sequelize.query(
      "SELECT chain_kpi_id, COUNT(*) as total_assignments, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_assignments FROM chain_kpi_daily_tasks WHERE date = ? GROUP BY chain_kpi_id",
      { replacements: [date] }
    );

    console.log(JSON.stringify({ days, counts }, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(2);
  }
})();
