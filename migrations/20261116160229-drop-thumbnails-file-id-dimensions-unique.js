'use strict';

const constraintName = 'thumbnails_file_id_max_width_max_height_type_key';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE thumbnails DROP CONSTRAINT IF EXISTS ${constraintName};`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ${constraintName} ON thumbnails (file_id, max_width, max_height, type);`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE thumbnails ADD CONSTRAINT ${constraintName} UNIQUE USING INDEX ${constraintName};`,
    );
  },
};
