'use strict';

const tableName = 'private_sharing_folder';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      folder_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'folders',
          key: 'uuid',
        },
      },
      owner_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'uuid',
        },
      },
      shared_with: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'uuid',
        },
      },
      encryption_key: {
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

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS ${tableName}`);
  },
};
