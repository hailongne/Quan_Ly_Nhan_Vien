const fs = require('fs');
const path = require('path');
const sequelize = require('../config/db');

const fileArg = process.argv[2];
const sqlPath = fileArg
  ? path.resolve(fileArg)
  : path.resolve(__dirname, '../migrations/20260203-add-kpi-output-tables.sql');

const run = async () => {
  try {
    if (!fs.existsSync(sqlPath)) {
      console.error(`SQL file not found: ${sqlPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = sql
      .split(/;\s*\n/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await sequelize.query(stmt);
    }

    console.log(`Migration executed: ${sqlPath}`);
    await sequelize.close();
  } catch (err) {
    console.error('Migration failed:', err);
    try { await sequelize.close(); } catch (e) { /* ignore */ }
    process.exit(1);
  }
};

run();
