'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY file_versions_user_id_exists_idx
      ON file_versions (user_id)
      WHERE status = 'EXISTS';
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS file_versions_user_id_exists_idx;
    `);
  }
};
