'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `
      CREATE INDEX CONCURRENTLY deleted_file_versions_processed_enqueued_index
      ON deleted_file_versions
      USING btree (enqueued, processed)
      WHERE enqueued = false AND processed = false
      `,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY deleted_file_versions_processed_enqueued_index`,
    );
  },
};
