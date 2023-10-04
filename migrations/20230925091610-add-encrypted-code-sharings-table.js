'use strict';

const tableName = 'sharings';
const newColumn = 'encrypted_code';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, newColumn, {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn);
  },
};
