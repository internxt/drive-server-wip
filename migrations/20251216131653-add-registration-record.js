'use strict';

const tableName = 'users';
const newColumn = 'registration_record';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, newColumn, {
      type: Sequelize.STRING(300),
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn(tableName, newColumn, {
      type: Sequelize.STRING(300),
    });
  },
};
