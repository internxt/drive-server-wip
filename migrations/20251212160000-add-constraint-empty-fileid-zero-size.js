'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `
        ALTER TABLE files
        ADD CONSTRAINT check_fileid_null_only_for_zero_size
        CHECK (
          (file_id IS NOT NULL AND file_id != '') OR size = 0
        );
      `,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE files DROP CONSTRAINT IF EXISTS check_fileid_null_only_for_zero_size`,
    );
  },
};
