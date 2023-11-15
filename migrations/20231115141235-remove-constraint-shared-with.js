'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeConstraint(
      'sharing_invites',
      'sharing_invites_shared_with_fkey',
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addConstraint('sharing_invites', {
      type: 'FOREIGN KEY',
      fields: ['shared_with'],
      name: 'sharing_invites_shared_with_fkey',
      references: {
        table: 'users',
        field: 'uuid',
      },
    });
  },
};
