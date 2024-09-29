'use strict';

const tableName = 'files';
const indexName = 'files_modification_time_index';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex(tableName, ['modification_time'], {
      name: indexName,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(tableName, indexName);
  },
};
