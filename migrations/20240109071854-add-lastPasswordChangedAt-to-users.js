'use strict';

const tableName = 'users';
const newColumn = 'last_password_changed_at';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable(tableName);
    //  Only add column if is not created in the table
    if (!tableDefinition[newColumn]) {
      return queryInterface.addColumn(tableName, newColumn, {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn);
  },
};
