'use strict';

const tableName = 'deleted_files';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, 'processed', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    await queryInterface.addColumn(tableName, 'created_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn(tableName, 'updated_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn(tableName, 'processed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn(tableName, 'enqueued', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    await queryInterface.addColumn(tableName, 'enqueued_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn(tableName, 'network_file_id', {
      type: Sequelize.STRING(24),
      allowNull: false,
      defaultValue: '',
    });

    await queryInterface.addIndex(tableName, ['processed'], {
      name: 'deleted_files_processed_index',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, 'processed');
    await queryInterface.removeColumn(tableName, 'created_at');
    await queryInterface.removeColumn(tableName, 'updated_at');
    await queryInterface.removeColumn(tableName, 'processed_at');
    await queryInterface.removeColumn(tableName, 'enqueued');
    await queryInterface.removeColumn(tableName, 'enqueued_at');
    await queryInterface.removeColumn(tableName, 'network_file_id');
    await queryInterface.removeIndex(
      tableName,
      'deleted_files_processed_index',
    );
  },
};
