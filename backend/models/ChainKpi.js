const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ChainKpi = sequelize.define('ChainKpi', {
    chain_kpi_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    created_by: { type: DataTypes.INTEGER },
    start_date: { type: DataTypes.DATEONLY },
    end_date: { type: DataTypes.DATEONLY },
    description: { type: DataTypes.TEXT },
    // store KPI names as JSON array: ["KPI name 1", "KPI name 2"]
    kpi_name: { type: DataTypes.JSON, allowNull: true },
    department_id: { type: DataTypes.INTEGER },
    transfer_source_kpi_id: { type: DataTypes.INTEGER, allowNull: true },
    total_kpi: { type: DataTypes.INTEGER },
    workdays_count: { type: DataTypes.INTEGER },
    status: { type: DataTypes.STRING, defaultValue: 'draft' }
  }, {
    tableName: 'chain_kpis',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return ChainKpi;
};
