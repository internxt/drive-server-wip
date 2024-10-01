'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `
        CREATE UNIQUE INDEX CONCURRENTLY files_plainname_type_folderid_exists_unique 
        ON files USING btree (plain_name, type, folder_id) 
        WHERE (status = 'EXISTS');
      `,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS files_plainname_type_folderid_exists_unique`,
    );
  },
};
