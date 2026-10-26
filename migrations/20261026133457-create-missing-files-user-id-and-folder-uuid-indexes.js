'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Created manually in prod, missing in local/test databases. This syncs both
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS files_user_id_foreign_idx ON files (user_id)',
    );
    await queryInterface.sequelize.query(
      `
        CREATE INDEX CONCURRENTLY IF NOT EXISTS files_folder_uuid_non_deleted_idx
        ON files (folder_uuid)
        WHERE status != 'DELETED'
      `,
    );
  },
  async down() {},
};
