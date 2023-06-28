'use strict';

const fuzzySearchTableName = 'look_up';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(fuzzySearchTableName, {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      user_uuid: {
        type: Sequelize.STRING(36),
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.sequelize.query('create extension pg_trgm');
  },

  async down(queryInterface) {
    await queryInterface.dropTable(fuzzySearchTableName);

    await queryInterface.sequelize.query('drop extension pg_trgm');
  },
};
