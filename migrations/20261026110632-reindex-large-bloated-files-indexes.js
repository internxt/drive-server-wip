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
  // Smallest first
  async up(queryInterface) {
    await reindexIfExists(queryInterface, 'ux_files_id');
    await reindexIfExists(queryInterface, 'idx_files_user_created_at');
    await reindexIfExists(queryInterface, 'files_pkey');
  },

  async down() {},
};
