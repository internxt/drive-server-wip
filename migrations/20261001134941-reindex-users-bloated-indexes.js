'use strict';

const indexes = [
  'users_email_idx',
  'bridge_user_index',
  'username',
  'uuid_UNIQUE',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // REINDEX CONCURRENTLY cannot run inside a transaction block, one statement per query
    for (const index of indexes) {
      await queryInterface.sequelize.query(
        `REINDEX INDEX CONCURRENTLY "${index}"`,
      );
    }
  },

  async down() {},
};
