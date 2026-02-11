'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_folder_user_exists
      ON files (folder_uuid, user_id)
      WHERE status = 'EXISTS';
    `);
  },

  async down (queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX CONCURRENTLY IF EXISTS idx_files_folder_user_exists;`);
  }
};
