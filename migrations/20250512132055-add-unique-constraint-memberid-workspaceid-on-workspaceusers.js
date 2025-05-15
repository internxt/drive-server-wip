'use strict';

const tableName = 'workspace_users';
const partialIndexName = 'workspace_users_active_member_workspace_index';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX CONCURRENTLY ${partialIndexName}
      ON ${tableName} (member_id, workspace_id)
      WHERE deactivated = false;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${partialIndexName};`,
    );
  },
};
