'use strict';

const indexName = 'idx_files_trashed_user_updated_at';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
      ON files (user_id, updated_at)
      WHERE status = 'TRASHED'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`,
    );
  },
};
