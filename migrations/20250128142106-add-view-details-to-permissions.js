'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const roles = await queryInterface.sequelize.query('SELECT id FROM roles');

    const permissions = roles[0].map((role) => ({
      id: uuidv4(),
      role_id: role.id,
      name: 'VIEW_DETAILS',
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await queryInterface.bulkInsert('permissions', permissions);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('permissions', {
      name: 'VIEW_DETAILS',
    });
  }
};
