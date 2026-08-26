'use strict';

const BLOATED_DELETED_FILES_TABLE = 'deleted_files';
const OLD_RECORDS_TABLE = 'deleted_files_old_records';
const CHECKPOINT_TABLE = 'migration_checkpoint';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    // Data already migrated to deleted_files_old_records.
    await sequelize.query(`DROP TABLE IF EXISTS ${BLOATED_DELETED_FILES_TABLE}`);

    await sequelize.query(`DROP TABLE IF EXISTS ${CHECKPOINT_TABLE}`);

    await sequelize.query(
      `ALTER TABLE IF EXISTS ${OLD_RECORDS_TABLE} RENAME TO ${BLOATED_DELETED_FILES_TABLE}`,
    );
  },

  async down() {
    // No-op
  },
};
