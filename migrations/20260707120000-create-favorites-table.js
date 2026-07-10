'use strict';

const tableName = 'favorites';
const uniqueIndexName = 'favorites_user_id_item_id_item_type_unique';
const userIdItemTypeIndexName = 'favorites_user_id_item_type_index';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      user_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'uuid',
        },
        onDelete: 'CASCADE',
      },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      item_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
    await queryInterface.addIndex(
      tableName,
      ['user_id', 'item_id', 'item_type'],
      {
        unique: true,
        name: uniqueIndexName,
      },
    );
    await queryInterface.addIndex(tableName, ['user_id', 'item_type'], {
      name: userIdItemTypeIndexName,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(tableName, userIdItemTypeIndexName);
    await queryInterface.removeIndex(tableName, uniqueIndexName);
    await queryInterface.dropTable(tableName);
  },
};
