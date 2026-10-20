'use strict';

const indexName = 'sharing_invites_item_id_item_type_index';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
      ON sharing_invites (item_id, item_type)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`,
    );
  },
};
