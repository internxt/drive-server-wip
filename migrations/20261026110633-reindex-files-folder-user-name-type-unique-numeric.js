'use strict';

// REINDEX has no IF EXISTS and CONCURRENTLY can't run inside a DO block
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
  // Needs ~110 GB free disk, kept apart from the rest
  async up(queryInterface) {
    await reindexIfExists(
      queryInterface,
      'idx_files_folder_user_name_type_unique_numeric',
    );
  },

  async down() {},
};
