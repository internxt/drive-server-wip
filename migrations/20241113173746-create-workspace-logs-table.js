'use strict';

const tableName = 'workspace_logs';
const indexName = 'workspace_id_workspace_logs_index';
const indexName2 = 'created_at_workspace_logs_index';
const indexName3 = 'platform_workspace_logs_index';
const indexName4 = 'creator_workspace_logs_index';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.DataTypes.UUID,
        primaryKey: true,
        defaultValue: Sequelize.DataTypes.UUIDV4,
      },
      workspace_id: {
        type: Sequelize.DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'workspaces',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      creator: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'uuid',
        },
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.DataTypes.STRING,
        allowNull: false,
      },
      paltform: {
        type: Sequelize.DataTypes.STRING,
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.DataTypes.UUID,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
    await queryInterface.addIndex(tableName, {
      fields: ['workspace_id'],
      name: indexName,
    });
    await queryInterface.addIndex(tableName, {
      fields: ['created_at'],
      name: indexName2,
    });
    await queryInterface.addIndex(tableName, {
      fields: ['paltform'],
      name: indexName3,
    });
    await queryInterface.addIndex(tableName, {
      fields: ['creator'],
      name: indexName4,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(tableName, indexName);
    await queryInterface.removeIndex(tableName, indexName2);
    await queryInterface.removeIndex(tableName, indexName3);
    await queryInterface.removeIndex(tableName, indexName4);
    await queryInterface.dropTable(tableName);
  },
};
