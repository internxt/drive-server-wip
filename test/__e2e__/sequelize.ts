import { Sequelize } from 'sequelize';
import getEnv from '../../src/config/configuration';

const { database } = getEnv();

const sequelizeTest = new Sequelize(
  database.database,
  database.username,
  database.password,
  {
    dialect: 'postgres',
    host: database.host,
    pool: {
      max: 20,
      min: 0,
      idle: 20000,
      acquire: 20000,
    },
  },
);

export { sequelizeTest };
