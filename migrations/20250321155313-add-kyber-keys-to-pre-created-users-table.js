'use strict';

const tableName = 'pre_created_users';
const newColumn1 = 'private_kyber_key';
const newColumn2 = 'public_kyber_key';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, newColumn1, {
      type: Sequelize.STRING(4000),
      allowNull: true,
    });

    await queryInterface.addColumn(tableName, newColumn2, {
      type: Sequelize.STRING(2000),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(tableName, newColumn1);
    await queryInterface.removeColumn(tableName, newColumn2);
  },
};
