'use strict';

const indexName = 'idx_folders_user_parent_numname';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
      ON folders (user_id, parent_uuid, plain_name COLLATE "custom_numeric")
      WHERE deleted = false AND removed = false
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`,
    );
  },
};
