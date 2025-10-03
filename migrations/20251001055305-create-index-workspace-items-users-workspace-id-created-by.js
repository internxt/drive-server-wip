'use strict';

const indexName = 'workspace_items_users_workspace_creator_index';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY ${indexName} ON workspace_items_users (workspace_id, created_by)`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY ${indexName}`,
    );
  },
};
