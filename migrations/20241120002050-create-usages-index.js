'use strict';

const indexName = 'usage_user_type_period_index';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY ${indexName} ON usages (user_id, type, period)`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY ${indexName}`,
    );
  },
};
