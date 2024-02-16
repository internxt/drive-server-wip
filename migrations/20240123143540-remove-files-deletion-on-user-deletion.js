'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeConstraint('files', 'files_user_id_fkey');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addConstraint('files', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'files_user_id_fkey',
      references: {
        table: 'users',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },
};
