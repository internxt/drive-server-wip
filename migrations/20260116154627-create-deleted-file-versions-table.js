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
      network_file_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      size: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      processed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
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
        allowNull: false,
        defaultValue: false,
      },
      enqueued_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(tableName);
  },
};
