'use strict';

const newIndexName = 'idx_files_trashed_user_updated_at';
const oldIndexName = 'idx_files_updated_at_user_id';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS ${newIndexName}
      ON files (user_id, updated_at, uuid)
      WHERE status = 'TRASHED'
    `);

    await queryInterface.sequelize.query(`
      COMMENT ON INDEX ${newIndexName} IS
      'Per-user trashed files: trash cleanup job, trash listing and TRASHED cursor sync.';
    `);

    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${oldIndexName}`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS ${oldIndexName}
      ON files (updated_at, user_id, uuid)
      WHERE status = 'TRASHED'
    `);

    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${newIndexName}`,
    );
  },
};
