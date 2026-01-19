'use strict';

const tableName = 'file_versions';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, 'user_id', {
      type: Sequelize.STRING(36),
      allowNull: false,
      references: {
        model: 'users',
        key: 'uuid',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY file_versions_user_id_exists_idx
      ON file_versions(user_id)
      WHERE status = 'EXISTS';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS file_versions_user_id_exists_idx;
    `);
    await queryInterface.removeColumn(tableName, 'user_id');
  },
};
