'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP INDEX CONCURRENTLY files_modification_time_index;`);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`CREATE INDEX CONCURRENTLY ${indexName} ON ${tableName} (modification_time);`);
  }
};
