'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('shares', 'password', {
      type: Sequelize.BLOB('medium'),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('shares', 'password');
  },
};
