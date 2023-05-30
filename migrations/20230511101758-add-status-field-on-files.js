'use strict';

const tableName = 'files';
const newColumn = 'status';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, newColumn, {
      type: Sequelize.ENUM('EXISTS', 'TRASHED', 'DELETED'),
      defaultValue: 'EXISTS',
      allowNull: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn);
  },
};
