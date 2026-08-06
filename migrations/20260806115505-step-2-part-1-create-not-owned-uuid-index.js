'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX CONCURRENTLY ux_files_uuid_pk ON files USING btree (uuid);
      `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        DROP INDEX CONCURRENTLY IF EXISTS ux_files_uuid_pk;
      `);
  }
};
