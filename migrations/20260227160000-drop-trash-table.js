'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('trash');
  },

  async down(queryInterface, Sequelize) {
    const tableName = 'trash';

    await queryInterface.createTable(tableName, {
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'UUID of the file or folder in trash',
      },
      item_type: {
        type: Sequelize.ENUM('file', 'folder'),
        allowNull: false,
        comment: 'Type of item: file or folder',
      },
      caducity_date: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Date when the item will be permanently deleted',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'User who owns the trashed item',
      },
    });

    await queryInterface.addConstraint(tableName, {
      type: 'PRIMARY KEY',
      fields: ['item_id', 'item_type'],
      name: 'trash_pk',
    });

    await queryInterface.addIndex(tableName, ['caducity_date'], {
      name: 'idx_trash_caducity_date',
      using: 'BTREE',
    });

    await queryInterface.addIndex(tableName, ['user_id'], {
      name: 'idx_trash_user_id',
      using: 'BTREE',
    });

    await queryInterface.addConstraint(tableName, {
      type: 'FOREIGN KEY',
      fields: ['user_id'],
      name: 'trash_user_id_fkey',
      references: {
        table: 'users',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },
};
