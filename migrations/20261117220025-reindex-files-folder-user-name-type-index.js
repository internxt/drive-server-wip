'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'REINDEX INDEX CONCURRENTLY public.idx_files_folder_user_name_type_unique_numeric',
    );
  },

  async down() {},
};
