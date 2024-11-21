'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `
        CREATE INDEX CONCURRENTLY files_updated_at_index 
        ON files USING btree (status, updated_at)
      `,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY files_updated_at_index`,
    );
  },
};
