'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS file_versions_user_id_created_at_exists_idx
      ON file_versions (user_id, created_at)
      WHERE status = 'EXISTS';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS file_versions_user_id_created_at_exists_idx;
    `);
  },
};
