'use strict';

const tableName = 'file_versions';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, 'folder_uuid', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'folders',
        key: 'uuid',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex(tableName, ['folder_uuid', 'status'], {
      name: 'file_versions_folder_uuid_status_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      tableName,
      'file_versions_folder_uuid_status_idx',
    );
    await queryInterface.removeColumn(tableName, 'folder_uuid');
  },
};
