'use strict';

// Smallest first
const indexes = [
  'user_id_folders_index',
  'idx_deleted_files_updated_at',
  'deleted_folders_pkey',
  'folders_parent_id_idx',
  'deleted_files_new_pkey',
  '"folders_uuid_UNIQUE"',
  'thumbnails_pkey',
  'files_files_folder_id_foreign_id_fk',
  'thumbnails_file_uuid_idx',
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
