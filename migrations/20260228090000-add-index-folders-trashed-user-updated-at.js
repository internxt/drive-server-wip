'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_folders_trashed_user_updated_at
      ON folders (user_id, updated_at, uuid)
      WHERE deleted = true AND removed = false
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_folders_trashed_user_updated_at
    `);
  },
};
