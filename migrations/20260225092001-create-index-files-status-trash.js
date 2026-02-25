'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  useTransaction: false,
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_status_trash ON files (user_id) WHERE status = 'TRASHED';`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_files_status_trash;`,
    );
  },
};
