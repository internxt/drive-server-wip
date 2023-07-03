'use strict';

const lookUpTableName = 'look_up';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(lookUpTableName, {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
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
        type: Sequelize.STRING(36),
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
      },
    });

    await queryInterface.addIndex('look_up', {
      fields: ['user_id'],
      name: 'user_uuid_look_up_index',
    });

    await queryInterface.sequelize.query('create extension pg_trgm');
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('look_up', 'user_uuid_look_up_index');

    await queryInterface.dropTable(lookUpTableName);

    await queryInterface.sequelize.query('drop extension pg_trgm');
  },
};
