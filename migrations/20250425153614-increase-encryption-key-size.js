'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('sharings', 'encryption_key', {
      type: Sequelize.STRING(2500),
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('sharings', 'encryption_key', {
      type: Sequelize.STRING(2000),
    });
  },
};
