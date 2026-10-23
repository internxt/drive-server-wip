'use strict';

// Smallest first: each rebuild needs free disk space equal to the index size
const indexes = [
  'user_id_folders_index',
  'idx_deleted_files_updated_at',
  'folders_parent_uuid_index',
  'folders_parent_id_idx',
  '"folders_uuid_UNIQUE"',
  'files_folder_uuid_index',
  'files_files_folder_id_foreign_id_fk',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const index of indexes) {
      await queryInterface.sequelize.query(
        `REINDEX INDEX CONCURRENTLY ${index}`,
      );
    }
  },

  async down() {},
};
