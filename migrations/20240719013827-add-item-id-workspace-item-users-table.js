'use strict';

const indexName = 'workspace_items_users_item_id_index';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY ${indexName} ON workspace_items_users (item_id)`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY ${indexName}`,
    );
  },
};
