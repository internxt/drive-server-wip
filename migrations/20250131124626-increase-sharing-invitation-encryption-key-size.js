'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('sharing_invites', 'encryption_key', {
      type: Sequelize.STRING(2000),
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('sharing_invites', 'encryption_key', {
      type: Sequelize.STRING(800),
    });
  },
};
