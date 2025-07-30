'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `
        CREATE INDEX CONCURRENTLY deleted_folders_updated_at_index
        ON folders USING btree (updated_at) 
        WHERE (removed = true);
      `,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS deleted_folders_updated_at_index`,
    );
  },
};
