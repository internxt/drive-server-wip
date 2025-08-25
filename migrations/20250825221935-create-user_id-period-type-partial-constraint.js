'use strict';

const indexName = 'usage_unique_user_period_type_monthly_yearly';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX CONCURRENTLY ${indexName} ON public.usages (user_id, period, type) 
        WHERE type = 'monthly' OR type = 'yearly';`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY ${indexName}`,
    );
  },
};
