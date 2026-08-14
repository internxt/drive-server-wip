'use strict';


module.exports = {
  async up(queryInterface) {
    // Drop duplicated folders uuid index. Index does not have any 'folders' prefix but it is linked to folders.
    await queryInterface.sequelize.query(
      'DROP INDEX CONCURRENTLY IF EXISTS uuid_index;',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS uuid_index ON folders (uuid);',
    );
  }
};
