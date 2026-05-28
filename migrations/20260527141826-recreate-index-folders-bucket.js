'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS bucket_index ON folders (bucket) WHERE deleted = false AND removed = false AND parent_id IS NULL`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS bucket_index`,
    );
  },
};
