'use strict';

const indexName = 'idx_send_links_created_at_with_sender';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
      ON send_links (created_at)
      WHERE sender IS NOT NULL
    `);

    await queryInterface.sequelize.query(`
      COMMENT ON INDEX ${indexName} IS
      'Daily count of send links with a sender, used to cap notification emails.';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`,
    );
  },
};
