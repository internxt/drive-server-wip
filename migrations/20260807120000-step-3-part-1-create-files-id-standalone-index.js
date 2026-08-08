'use strict';

// UUID as PK: Step 3 - 1: Create standalone index on id, not owned by files_pkey.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX CONCURRENTLY ux_files_id_idx ON files USING btree (id);
      `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        DROP INDEX CONCURRENTLY IF EXISTS ux_files_id_idx;
      `);
  }
};
