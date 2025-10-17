'use strict';

const indexNameUsers = 'idx_users_updated_at';
const indexNameMailLimits = 'idx_mail_limits_mail_type';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexNameUsers} ON users (updated_at)`,
    );
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexNameMailLimits} ON mail_limits (mail_type)`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${indexNameUsers}`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${indexNameMailLimits}`);
  },
};
