'use strict';

const tableName = 'file_versions';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, 'user_id', {
      type: Sequelize.STRING(36),
      allowNull: true,
      references: {
        model: 'users',
        key: 'uuid',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    await queryInterface.addIndex(tableName, ['user_id', 'status'], {
      name: 'file_versions_user_id_status_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(tableName, 'file_versions_user_id_status_idx');
    await queryInterface.removeColumn(tableName, 'user_id');
  },
};
