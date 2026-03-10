const sequelize = require('../config/db');
const makeUser = require('./User');
const makeDepartment = require('./Department');
const makePasswordReset = require('./PasswordReset');
const makeChainKpi = require('./ChainKpi');

let makePosition = null;
try {
  // Optional legacy model; ignore if missing
  // eslint-disable-next-line global-require
  makePosition = require('./Position');
} catch (err) {
  makePosition = null;
}

const User = makeUser(sequelize);
const Department = makeDepartment(sequelize);
const Position = makePosition ? makePosition(sequelize) : null;
const PasswordReset = makePasswordReset(sequelize);
const ChainKpi = makeChainKpi(sequelize);

const models = {
  sequelize,
  User,
  Department,
  Position,
  PasswordReset,
  ChainKpi,
};

Object.values(models).forEach(model => {
  if (model && typeof model.associate === 'function') {
    model.associate(models);
  }
});

module.exports = models;
