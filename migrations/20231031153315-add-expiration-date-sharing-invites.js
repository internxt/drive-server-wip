'use strict';

const tableName = 'sharing_invites';
const newColumn = 'expiration_at';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, newColumn, {
      type: Sequelize.DATE,
      defaultValue: null,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn);
  },
};
