'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'ALTER TABLE files ALTER COLUMN user_id SET STATISTICS 500;',
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE files ALTER COLUMN updated_at SET STATISTICS 500;',
    );

    await queryInterface.sequelize.query(
      `
        CREATE STATISTICS files_user_updated_stats
        ON user_id, updated_at FROM files;
      `,
    );

    // Run ANALYZE to populate the statistics
    await queryInterface.sequelize.query('ANALYZE files;');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DROP STATISTICS IF EXISTS files_user_updated_stats`,
    );

    // Reset statistics target to default (use default_statistics_target)
    await queryInterface.sequelize.query(
      'ALTER TABLE files ALTER COLUMN user_id SET STATISTICS -1;',
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE files ALTER COLUMN updated_at SET STATISTICS -1;',
    );
  },
};
