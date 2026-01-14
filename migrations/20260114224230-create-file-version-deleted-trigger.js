'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS file_version_deleted_trigger ON file_versions;
    `);

    await queryInterface.sequelize.query(`
      CREATE TRIGGER file_version_deleted_trigger
      AFTER UPDATE ON file_versions
      FOR EACH ROW
      WHEN (OLD.status != 'DELETED' AND NEW.status = 'DELETED')
      EXECUTE FUNCTION insert_into_deleted_file_versions();
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS file_version_deleted_trigger ON file_versions;
    `);
  },
};
