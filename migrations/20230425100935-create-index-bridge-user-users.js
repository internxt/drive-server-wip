'use strict';

const indexName = 'bridge_user_index';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('users', {
      fields: ['bridge_user'],
      name: indexName,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', indexName);
  },
};
