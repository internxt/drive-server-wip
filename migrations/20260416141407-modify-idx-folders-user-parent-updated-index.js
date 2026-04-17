'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_folders_user_id_updated_at_parent_uuid_not_null
      ON folders (user_id, updated_at)
      WHERE parent_uuid IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_folders_user_parent_updated;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_folders_user_parent_updated
      ON folders (user_id, updated_at)
      WHERE parent_id IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_folders_user_id_updated_at_parent_uuid_not_null;
    `);
  },
};
