'use strict';

const tableName = 'private_sharing_folder_roles';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.STRING(36),
        references: {
          model: 'users',
          key: 'uuid',
        },
        allowNull: false,
        onDelete: 'CASCADE',
      },
      folder_id: {
        type: Sequelize.UUID,
        references: {
          model: 'folders',
          key: 'uuid',
        },
        allowNull: false,
        onDelete: 'CASCADE',
      },
      role_id: {
        type: Sequelize.UUID,
        references: {
          model: 'roles',
          key: 'id',
        },
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable(tableName);
  },
};
