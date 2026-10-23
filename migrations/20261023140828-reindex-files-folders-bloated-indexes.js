'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Smallest first: each rebuild needs free disk space equal to the index size
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY user_id_folders_index',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY idx_deleted_files_updated_at',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY folders_parent_uuid_index',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY folders_parent_id_idx',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY "folders_uuid_UNIQUE"',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY files_folder_uuid_index',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY files_files_folder_id_foreign_id_fk',
    );
  },

  async down() {},
};
