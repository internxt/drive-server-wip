'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_deleted_updatedat_brin
      ON files USING brin (updated_at)
      WHERE status = 'DELETED';
    `);
    await queryInterface.sequelize.query(`
  DROP INDEX CONCURRENTLY IF EXISTS files_status_updatedat_key;
`);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTs files_status_updatedat_key 
      ON files (status, updated_at) 
      WHERE status = 'DELETED';
    `);
    await queryInterface.sequelize.query(`DROP INDEX CONCURRENTLY idx_files_deleted_updatedat_brin;`);
  }
};
