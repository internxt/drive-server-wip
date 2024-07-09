'use strict';

const tableName = 'workspaces';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      owner_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'uuid',
        },
      },
      address: Sequelize.STRING,
      name: Sequelize.STRING,
      description: Sequelize.STRING,
      setup_completed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      default_team_id: {
        type: Sequelize.UUID,
      },
      workspace_user_id: {
        type: Sequelize.STRING(36),
        references: {
          model: 'users',
          key: 'uuid',
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

  async down(queryInterface) {
    await queryInterface.dropTable(tableName);
  },
};
