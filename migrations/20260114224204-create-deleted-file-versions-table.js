'use strict';

const tableName = 'deleted_file_versions';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      file_version_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      file_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      network_file_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      size: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      processed: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      enqueued: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      enqueued_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex(tableName, {
      fields: ['processed'],
      name: 'deleted_file_versions_processed_index',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(tableName);
  },
};
