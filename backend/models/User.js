const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    user_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING, unique: true },
    password: { type: DataTypes.STRING },
    username: { type: DataTypes.STRING, unique: true },
    phone: { type: DataTypes.STRING },
    department_id: { type: DataTypes.INTEGER },
    department: { type: DataTypes.STRING },
    department_position: { type: DataTypes.STRING },
    address: { type: DataTypes.STRING },
    date_joined: { type: DataTypes.DATE },
    employment_status: { type: DataTypes.STRING },
    official_confirmed_at: { type: DataTypes.DATE },
    remaining_leave_days: { type: DataTypes.INTEGER },
    work_shift_start: { type: DataTypes.STRING },
    work_shift_end: { type: DataTypes.STRING },
    note: { type: DataTypes.TEXT },
    role: { type: DataTypes.STRING },
    avatar_url: { type: DataTypes.STRING },
    cv_url: { type: DataTypes.STRING }
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return User;
};
