'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('files', 'file_id', {
      type: Sequelize.STRING(24),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('files', 'file_id', {
      type: Sequelize.STRING(24),
      allowNull: false,
    });
  },
};
