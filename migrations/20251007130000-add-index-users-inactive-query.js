'use strict';

const indexName = 'idx_users_updated_at';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON users (updated_at)`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${indexName}`);
  },
};
