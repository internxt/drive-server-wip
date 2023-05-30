'use strict';

const indexName = 'files_status_index';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY ${indexName} ON files (status)`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY ${indexName}`,
    );
  },
};
