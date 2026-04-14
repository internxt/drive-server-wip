'use strict';

const indexName = 'idx_files_updated_at_user_id';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
      ON files (updated_at, user_id, uuid)
      WHERE status = 'TRASHED'
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS ${indexName}
    `);
  },
};
