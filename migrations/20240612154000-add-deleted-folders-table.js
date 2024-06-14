'use strict';

const tableName = 'deleted_folders';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      folder_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
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
      name: 'processed_index',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(tableName);
  },
};
