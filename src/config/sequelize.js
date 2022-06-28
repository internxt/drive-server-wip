module.exports = {
  development: {
    dialect: 'mariadb',
    host: process.env.RDS_HOSTNAME,
    database: process.env.RDS_DBNAME,
    username: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    port: process.env.RDS_PORT,
    logging: true,
    dialectOptions: {
      connectTimeout: 20000,
      options: {
        requestTimeout: 4000,
      },
    },
    pool: {
      maxConnections: Number.MAX_SAFE_INTEGER,
      maxIdleTime: 30000,
      max: 20,
      min: 0,
      idle: 20000,
      acquire: 20000,
    },
  },
  test: {
    username: 'root',
    password: null,
    database: 'drive_test',
    host: '127.0.0.1',
    dialect: 'mariadb',
    dialectOptions: {
      connectTimeout: 20000,
      options: {
        requestTimeout: 4000,
      },
    },
    pool: {
      maxConnections: Number.MAX_SAFE_INTEGER,
      maxIdleTime: 30000,
      max: 20,
      min: 0,
      idle: 20000,
      acquire: 20000,
    },
  },
  production: {
    host: process.env.RDS_HOSTNAME,
    database: process.env.RDS_DBNAME,
    username: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    dialect: 'mariadb',
    dialectOptions: {
      connectTimeout: 20000,
      options: {
        requestTimeout: 4000,
      },
    },
    pool: {
      maxConnections: Number.MAX_SAFE_INTEGER,
      maxIdleTime: 30000,
      max: 20,
      min: 0,
      idle: 20000,
      acquire: 20000,
    },
  },
};
