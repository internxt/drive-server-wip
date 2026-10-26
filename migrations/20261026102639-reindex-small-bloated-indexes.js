'use strict';

const reindexIfExists = async (queryInterface, index) => {
  const [[{ exists }]] = await queryInterface.sequelize.query(
    `SELECT to_regclass('${index}') IS NOT NULL AS exists`,
  );
  if (exists) {
    await queryInterface.sequelize.query(`REINDEX INDEX CONCURRENTLY ${index}`);
  }
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Smallest first
  async up(queryInterface) {
    await reindexIfExists(queryInterface, 'user_id_folders_index');
    await reindexIfExists(queryInterface, 'idx_deleted_files_updated_at');
    await reindexIfExists(queryInterface, 'deleted_folders_pkey');
    await reindexIfExists(queryInterface, 'folders_parent_id_idx');
    await reindexIfExists(queryInterface, 'deleted_files_new_pkey');
    await reindexIfExists(queryInterface, '"folders_uuid_UNIQUE"');
    await reindexIfExists(queryInterface, 'thumbnails_pkey');
    await reindexIfExists(queryInterface, 'files_folder_uuid_index');
    await reindexIfExists(
      queryInterface,
      'files_files_folder_id_foreign_id_fk',
    );
    await reindexIfExists(queryInterface, 'thumbnails_file_uuid_idx');
  },

  async down() {},
};
