'use strict';

const oldIndexName = 'usage_unique_user_period_type_monthly_yearly';
const newIndexName = 'usage_unique_user_period_type_daily_monthly_yearly';

module.exports = {
  async up(queryInterface, _Sequelize) {
    // Create new index first to maintain constraint coverage
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX CONCURRENTLY ${newIndexName} ON public.usages (user_id, period, type)
        WHERE type = 'daily' OR type = 'monthly' OR type = 'yearly';`,
    );
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${oldIndexName};`,
    );
  },

  async down(queryInterface, _Sequelize) {
    // Recreate old index first
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX CONCURRENTLY ${oldIndexName} ON public.usages (user_id, period, type)
        WHERE type = 'monthly' OR type = 'yearly';`,
    );
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${newIndexName};`,
    );
  },
};
