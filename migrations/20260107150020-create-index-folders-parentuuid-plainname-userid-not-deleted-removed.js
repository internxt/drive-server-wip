'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
 async up(queryInterface, _Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_folders_user_parentuuid_plainname_not_deleted_removed
        ON folders (user_id, parent_uuid, plain_name)
        WHERE deleted = false AND removed = false;`,
    );
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_folders_user_parentuuid_plainname_not_deleted_removed;`,
    );
  },
};
