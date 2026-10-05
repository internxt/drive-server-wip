'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Prod index is named "username", other envs get "users_username_key" from 20210906090000-add_username_users. Aligns prod with them
    await queryInterface.sequelize.query(
      'ALTER INDEX IF EXISTS username RENAME TO users_username_key',
    );
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY users_username_key',
    );
  },

  async down() {},
};
