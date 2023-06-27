'use strict';

const fuzzySearchTableName = 'fuzzy_search';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(fuzzySearchTableName, {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.TSVECTOR,
        allowNull: false,
      },
      user_uuid: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: { model: 'users', key: 'uuid' },
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(fuzzySearchTableName);
  },
};
