'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeConstraint(
      'sharings',
      'sharings_shared_with_fkey',
    );
  },

  async down(queryInterface) {
    await queryInterface.addConstraint('sharings', {
      type: 'FOREIGN KEY',
      fields: ['shared_with'],
      name: 'sharings_shared_with_fkey',
      references: {
        table: 'users',
        field: 'uuid',
      },
    });
  },
};
