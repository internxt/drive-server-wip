'use strict';

const tableName = 'sharings';
const newColumn = 'type';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, newColumn, {
      type: Sequelize.ENUM('public', 'private'),
      defaultValue: 'private',
      allowNull: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn);
  },
};
