'use strict';

// UUID as PK: Step 2 - 2: Drop uuid unique constraint (index already guarantees uniqueness)
// CASCADE also drops thumbnails_file_uuid_fkey and file_versions_file_id_fkey,
// recreated in step-2-part-3 on top of ux_files_uuid_pk.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        ALTER TABLE files DROP CONSTRAINT files_uuid_key CASCADE;
      `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX CONCURRENTLY files_uuid_key_idx ON files USING btree (uuid);
      `);
    await queryInterface.sequelize.query(`
        ALTER TABLE files ADD CONSTRAINT files_uuid_key UNIQUE USING INDEX files_uuid_key_idx;
      `);
  }
};
