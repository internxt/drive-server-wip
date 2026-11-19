'use strict';

const indexes = ['idx_files_user_created_at', 'files_pkey'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const index of indexes) {
      await queryInterface.sequelize.query(
        `REINDEX INDEX CONCURRENTLY public.${index}`,
      );
    }
  },

  async down() {},
};
