'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY users_email_idx',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY bridge_user_index',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY username',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY "uuid_UNIQUE"',
    );
  },

  async down() {},
};
