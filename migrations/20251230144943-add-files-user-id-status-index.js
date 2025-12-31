'use strict';

const tableName = 'files';
const indexName = 'files_user_id_status_idx';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex(tableName, ['user_id', 'status'], {
      name: indexName,
      concurrently: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(tableName, indexName);
  },
};
