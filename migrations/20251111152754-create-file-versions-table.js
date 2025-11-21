'use strict';

const tableName = 'file_versions';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      file_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'files',
          key: 'uuid',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      network_file_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      size: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('EXISTS', 'DELETED'),
        allowNull: false,
        defaultValue: 'EXISTS',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex(tableName, ['file_id', 'status']);
    await queryInterface.addIndex(tableName, ['file_id', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable(tableName);
  },
};
