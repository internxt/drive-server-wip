'use strict';

const indexName = 'idx_files_status_trash';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON files (user_id, updated_at, uuid) WHERE status = 'TRASHED';`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${indexName}`);
  },
};
