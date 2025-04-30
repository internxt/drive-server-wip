'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const hasTypeColumn = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'permissions' AND column_name = 'type'
    `);

    const roles = await queryInterface.sequelize.query('SELECT id FROM roles');

    const permissions = roles[0].map((role) => {
      const permission = {
        id: uuidv4(),
        role_id: role.id,
        name: 'VIEW_DETAILS',
        created_at: new Date(),
        updated_at: new Date(),
      };

      if (hasTypeColumn[0].length > 0) {
        permission.type = 'VIEW_DETAILS';
      }

      return permission;
    });
    // Sequelize / DB fails if we pass empty array to inserts. Local environments do not have type column
    if (permissions.length > 0) {
      await queryInterface.bulkInsert('permissions', permissions);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('permissions', {
      name: 'VIEW_DETAILS',
    });
  },
};
