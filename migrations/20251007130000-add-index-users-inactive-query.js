'use strict';

const indexName = 'idx_users_inactive_query';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON users (tier_id, email_verified, updated_at)`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${indexName}`);
  },
};
