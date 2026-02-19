'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `
      CREATE UNIQUE INDEX CONCURRENTLY pre_created_users_username_index
      ON pre_created_users (username)
      `,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY pre_created_users_username_index`,
    );
  },
};
