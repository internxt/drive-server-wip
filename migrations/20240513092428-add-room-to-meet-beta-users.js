'use strict';

const tableName = 'meet_closed_beta_users';
const newColumn = 'room';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, newColumn, {
      type: Sequelize.UUID,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn);
  },
};
