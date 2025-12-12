'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `
        CREATE INDEX CONCURRENTLY idx_zero_size_files_per_user
        ON files(user_id)
        WHERE size = 0 AND status != 'DELETED';
      `,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS idx_zero_size_files_per_user`,
    );
  },
};
