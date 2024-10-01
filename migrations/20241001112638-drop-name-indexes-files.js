'use strict';

const indexName = 'files_status_index';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `
      DROP INDEX IF EXISTS files_status_index;
      DROP INDEX IF EXISTS files_name_type_folderid_deleted_unique;
      DROP INDEX IF EXISTS files_plainname_type_folderid_deleted_key;
      `,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY ${indexName} ON files (status)`,
    );
    await queryInterface.addIndex('files', ['name', 'type', 'folder_id'], {
      name: 'files_name_type_folderid_deleted_unique',
      unique: true,
      where: { deleted: { [Sequelize.Op.eq]: false } },
    });
    await queryInterface.addIndex(
      'files',
      ['plain_name', 'type', 'folder_id'],
      {
        name: 'files_plainname_type_folderid_deleted_key',
        unique: true,
        where: { deleted: { [Sequelize.Op.eq]: false } },
      },
    );
  },
};
