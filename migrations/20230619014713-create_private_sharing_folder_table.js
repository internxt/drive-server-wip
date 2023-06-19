'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('private_sharing_folder', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      folder_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'folders',
          key: 'id',
        },
        allowNull: false,
      },
      folder_uuid: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      owner_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id',
        },
        allowNull: false,
      },
      owner_uuid: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      shared_with_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id',
        },
        allowNull: false,
      },
      shared_with_uuid: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      encrypted_key: {
        type: Sequelize.STRING,
        allowNull: false,
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

  async down(queryInterface, Sequelize) {
    const tableList = await queryInterface.showAllTables();

    if (tableList.includes('private_sharing_folder')) {
      await queryInterface.dropTable('private_sharing_folder');
    }
  },
};
