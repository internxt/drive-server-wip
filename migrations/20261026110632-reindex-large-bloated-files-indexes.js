'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY ux_files_id',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY idx_files_user_created_at',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY files_pkey',
    );
  },

  async down() {},
};
