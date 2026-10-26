'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Smallest first
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY idx_files_trashed_user_updated_at',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY files_folder_uuid_non_deleted_idx',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY files_user_id_foreign_idx',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY idx_user_updated_at_status',
    );
  },

  async down() {},
};
