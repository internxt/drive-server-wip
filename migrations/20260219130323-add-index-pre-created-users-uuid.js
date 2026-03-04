'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS pre_created_users_uuid_index
      ON pre_created_users (uuid);
      `,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS pre_created_users_uuid_index`,
    );
  },
};
