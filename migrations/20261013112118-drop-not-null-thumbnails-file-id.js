'use strict';

const constraintName = 'thumbnails_file_id_not_null_check';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`SET lock_timeout = '5s';`);
    await queryInterface.sequelize.query(
      'ALTER TABLE thumbnails ALTER COLUMN file_id DROP NOT NULL;',
    );
  },

  async down(queryInterface) {
    // Validated CHECK lets SET NOT NULL skip the full scan under ACCESS EXCLUSIVE lock
    await queryInterface.sequelize.query(
      `ALTER TABLE thumbnails ADD CONSTRAINT ${constraintName} CHECK (file_id IS NOT NULL) NOT VALID;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE thumbnails VALIDATE CONSTRAINT ${constraintName};`,
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE thumbnails ALTER COLUMN file_id SET NOT NULL;',
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE thumbnails DROP CONSTRAINT ${constraintName};`,
    );
  },
};
