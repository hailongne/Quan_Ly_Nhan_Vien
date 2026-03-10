const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Department = sequelize.define('Department', {
    department_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    manager_user_id: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    tableName: 'departments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  Department.associate = (models) => {
    Department.belongsTo(models.User, { as: 'manager', foreignKey: 'manager_user_id' });
  };

  return Department;
};
