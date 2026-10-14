'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_user_uuid_exists
      ON files (user_id, uuid)
      WHERE status = 'EXISTS';
    `);

    await queryInterface.sequelize.query(`
      COMMENT ON INDEX idx_files_user_uuid_exists IS
      'Temporary: Drop once Windows moves to cursor-based sync.';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_files_user_uuid_exists;
    `);
  },
};
