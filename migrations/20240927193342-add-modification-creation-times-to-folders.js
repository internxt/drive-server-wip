'use strict';

const tableName = 'folders';
const newColumn1 = 'creation_time';
const newColumn2 = 'modification_time';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, newColumn1, {
      type: Sequelize.DATE,
      defaultValue: Sequelize.fn('NOW'),
      allowNull: false,
    });

    await queryInterface.addColumn(tableName, newColumn2, {
      type: Sequelize.DATE,
      defaultValue: Sequelize.fn('NOW'),
      allowNull: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn1);
    await queryInterface.removeColumn(tableName, newColumn2);
  },
};
