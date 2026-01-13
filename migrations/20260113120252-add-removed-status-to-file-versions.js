'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_file_versions_status" ADD VALUE IF NOT EXISTS 'REMOVED';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_file_versions_status_old" AS ENUM ('EXISTS', 'DELETED');

      ALTER TABLE file_versions
        ALTER COLUMN status TYPE "enum_file_versions_status_old"
        USING status::text::"enum_file_versions_status_old";

      DROP TYPE "enum_file_versions_status";

      ALTER TYPE "enum_file_versions_status_old" RENAME TO "enum_file_versions_status";
    `);
  },
};
