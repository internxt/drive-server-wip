'use strict';

const indexName = 'files_folder_uuid_index';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('files', {
      fields: ['folder_uuid'],
      name: indexName,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('files', indexName);
  },
};
