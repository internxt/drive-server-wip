'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex('look_up', {
      fields: ['user_uuid'],
      name: 'user_uuid_look_up_index',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('look_up', 'user_uuid_look_up_index');
  },
};
