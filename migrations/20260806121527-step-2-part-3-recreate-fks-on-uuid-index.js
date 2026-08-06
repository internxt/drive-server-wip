'use strict';

// UUID as PK: Step 2 - 3: Recreate FKs dropped by CASCADE in part-2, now backed by ux_files_uuid_pk
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE thumbnails ADD CONSTRAINT thumbnails_file_uuid_fkey
          FOREIGN KEY (file_uuid) REFERENCES files(uuid) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
      `);
    await queryInterface.sequelize.query(`
        ALTER TABLE file_versions ADD CONSTRAINT file_versions_file_id_fkey
          FOREIGN KEY (file_id) REFERENCES files(uuid) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
      `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE file_versions DROP CONSTRAINT file_versions_file_id_fkey;
      `);
    await queryInterface.sequelize.query(`
        ALTER TABLE thumbnails DROP CONSTRAINT thumbnails_file_uuid_fkey;
      `);
  }
};
