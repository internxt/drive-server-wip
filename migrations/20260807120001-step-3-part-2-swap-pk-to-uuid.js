'use strict';

// UUID as PK: Step 3 - 2: Atomic PK swap, id -> uuid.
// Drops the OLD PK constraint and creates a new PK constraint on the uuid column leveraging the unique index.
// It retains the sequence and the unique index on the id column.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        SET LOCAL lock_timeout = '2s';
        ALTER TABLE files DROP CONSTRAINT files_pkey CASCADE;
        ALTER TABLE files ADD CONSTRAINT files_pkey PRIMARY KEY USING INDEX ux_files_uuid_pk;
        ALTER TABLE files ADD CONSTRAINT ux_files_id UNIQUE USING INDEX ux_files_id_idx;
        ALTER TABLE thumbnails ADD CONSTRAINT thumbnails_file_id_fkey
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
      `);
  },

  async down(queryInterface, Sequelize) {
    // There's no safe down automatic migration for this. It requires an INDEX creation and a PK swap.
    // You can manually restore the ID as PK by running the following SQL command:
    // ALTER TABLE files ADD CONSTRAINT files_pkey PRIMARY KEY USING INDEX ux_files_id_idx;
    // It leverages the previously created unique index on the id column.
  }
};
