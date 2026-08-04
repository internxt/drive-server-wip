'use strict';

const indexName = 'deleted_files_new_updated_at_idx';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
      ON deleted_files_new (updated_at)
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS ${indexName}
    `);
  },
};
