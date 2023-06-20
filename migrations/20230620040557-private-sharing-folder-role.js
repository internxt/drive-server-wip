'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('private_sharing_folder_roles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      user_uuid: {
        type: Sequelize.UUID,
      },
      folder_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'folders',
          key: 'id',
        },
      },
      folder_uuid: {
        type: Sequelize.UUID,
      },
      role_id: {
        type: Sequelize.UUID,
        references: {
          model: 'roles',
          key: 'id',
        },
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
    await queryInterface.dropTable('private_sharing_folder_roles');
  },
};
