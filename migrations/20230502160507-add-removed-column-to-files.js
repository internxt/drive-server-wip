'use strict';

const tableName = 'files';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, 'removed', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn(tableName, 'removed_at', { type: Sequelize.DATE });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn(tableName, 'removed');
    await queryInterface.removeColumn(tableName, 'removed_at');
  }
};
