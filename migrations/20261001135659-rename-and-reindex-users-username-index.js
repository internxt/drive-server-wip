'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER INDEX IF EXISTS username RENAME TO users_username_key',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY users_username_key',
    );
  },

  async down() {},
};
