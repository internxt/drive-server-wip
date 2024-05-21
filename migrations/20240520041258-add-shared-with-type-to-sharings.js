'use strict';

const tableName = 'sharings';
const newColumn = 'shared_with_type';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, newColumn, {
      type: Sequelize.ENUM('individual', 'workspace_team', 'workspace_member'),
      defaultValue: 'individual',
      allowNull: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn);
  },
};
