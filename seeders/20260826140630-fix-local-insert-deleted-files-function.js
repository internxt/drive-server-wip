'use strict';

// Local only trigger, fixes insert_deleted_files

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION insert_deleted_files()
      RETURNS trigger AS
      $$
      BEGIN
        INSERT INTO deleted_files_new (file_id, network_file_id, processed, created_at, updated_at, processed_at)
        SELECT uuid, file_id, false, NOW(), NOW(), NULL
        FROM files
        WHERE files.folder_id = OLD.id;
        RETURN OLD;
      END;
      $$
      LANGUAGE 'plpgsql';
    `);
  },

  async down() {
    // No-op: leave the fixed version in place.
  },
};
