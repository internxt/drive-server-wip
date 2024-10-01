'use strict';

const lookUpTableName = 'look_up';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(lookUpTableName, {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      tokenized_name: {
        type: Sequelize.DataTypes.TSVECTOR,
        allowNull: false,
      },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      item_type: {
        type: Sequelize.STRING(36),
        allowNull: false,
      },
      user_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: { model: 'users', key: 'uuid' },
        onDelete: 'CASCADE',
      },
    });

    await queryInterface.addIndex('look_up', {
      fields: ['user_id'],
      name: 'user_uuid_look_up_index',
    });

    await queryInterface.addIndex('look_up', {
      fields: ['item_id'],
      name: 'item_id_look_up_index',
    });

    await queryInterface.sequelize.query('create extension pg_trgm');
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('look_up', 'user_uuid_look_up_index');
    await queryInterface.removeIndex('look_up', 'item_id_look_up_index');

    await queryInterface.dropTable(lookUpTableName);

    await queryInterface.sequelize.query('drop extension pg_trgm');
  },
};
