'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY file_versions_user_id_status_idx
      ON file_versions (user_id, status);
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY file_versions_user_id_status_idx;
    `);
  }
};
