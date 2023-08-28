'use strict';

const tableName = 'sharing_invites';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      item_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      shared_with: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'uuid',
        },
      },
      encryption_algorithm: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      encryption_key: {
        type: Sequelize.STRING(800),
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'roles',
          key: 'id',
        },
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
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable(tableName);
  },
};
