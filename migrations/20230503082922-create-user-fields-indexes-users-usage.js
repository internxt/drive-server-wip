'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint('users_usage', {
      type: 'UNIQUE',
      fields: ['user_id'],
      name: 'user_id_index',
      references: {
        table: 'users',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('users_usage', {
      type: 'UNIQUE',
      fields: ['user_uuid'],
      name: 'user_uuid_index',
      references: {
        table: 'users',
        field: 'uuid',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('users_usage', 'user_id_index');
    await queryInterface.removeConstraint('users_usage', 'user_uuid_index');
  }
};
