'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.changeColumn('keyserver', 'public_key', {
      type: Sequelize.STRING(2000),
    });
    await queryInterface.changeColumn('keyserver', 'private_key', {
      type: Sequelize.STRING(4000),
    });
  },

  async down(queryInterface) {
    await queryInterface.changeColumn('keyserver', 'public_key', {
      type: Sequelize.STRING(1024),
    });
    await queryInterface.changeColumn('keyserver', 'private_key', {
      type: Sequelize.STRING(2000),
    });
  },
};
