'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('shares', 'password', {
      type: Sequelize.BLOB('medium'),
      allowNull: true,
    });

    await queryInterface.addColumn('send_links', 'password', {
      type: Sequelize.BLOB('medium'),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('shares', 'password');

    await queryInterface.removeColumn('send_links', 'password');
  },
};
