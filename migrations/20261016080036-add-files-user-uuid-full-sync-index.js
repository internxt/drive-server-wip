'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_user_uuid_full_sync
      ON files (user_id, uuid)
      WHERE (status = 'EXISTS') IS TRUE;
    `);

    await queryInterface.sequelize.query(`
      COMMENT ON INDEX idx_files_user_uuid_full_sync IS
      'Temporary: IS TRUE avoids cursor sync using it. Drop once Windows moves to cursor-based sync.';
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_files_user_uuid_exists;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_user_uuid_exists
      ON files (user_id, uuid)
      WHERE status = 'EXISTS';
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_files_user_uuid_full_sync;
    `);
  },
};
