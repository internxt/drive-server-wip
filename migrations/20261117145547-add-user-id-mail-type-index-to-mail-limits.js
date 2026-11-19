'use strict';

const indexName = 'idx_mail_limits_user_id_mail_type';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON mail_limits (user_id, mail_type)`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`,
    );
  },
};
