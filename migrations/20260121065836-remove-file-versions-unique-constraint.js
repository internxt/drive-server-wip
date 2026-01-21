'use strict';

const tableName = 'file_versions';
const indexName = 'file_versions_file_id_network_file_id_unique';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeIndex(tableName, indexName);
  },

  async down(queryInterface) {
    await queryInterface.addIndex(tableName, ['file_id', 'network_file_id'], {
      unique: true,
      name: indexName,
    });
  },
};
