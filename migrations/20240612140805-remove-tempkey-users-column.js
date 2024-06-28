'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    return queryInterface.removeColumn('users', 'temp_key');
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.addColumn('users', 'temp_key', {
      type: Sequelize.STRING(256),
    });
  },
};
