'use strict';

// NOTE: if this collation changes, update matching queries in file.repository.ts
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Enforce uniqueness and matches the collation used in the navigation queries
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_files_folder_user_name_type_unique_numeric
      ON files (folder_uuid, user_id, plain_name COLLATE "custom_numeric", type)
      WHERE status = 'EXISTS';
    `);

    // These indexes are redundant now
    await queryInterface.sequelize.query(
      'DROP INDEX CONCURRENTLY IF EXISTS idx_files_folder_user_exists;',
    );
    await queryInterface.sequelize.query(
      'DROP INDEX CONCURRENTLY IF EXISTS files_plainname_type_folderid_exists_unique;',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_folder_user_exists
      ON files (folder_uuid, user_id)
      WHERE status = 'EXISTS';
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS files_plainname_type_folderid_exists_unique
      ON files USING btree (plain_name, type, folder_id)
      WHERE (status = 'EXISTS');
    `);
    await queryInterface.sequelize.query(
      'DROP INDEX CONCURRENTLY IF EXISTS idx_files_folder_user_name_type_unique_numeric;',
    );
  },
};
