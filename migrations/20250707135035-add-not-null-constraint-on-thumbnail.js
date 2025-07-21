'use strict';

const constraintName = 'thumbnails_file_uuid_not_null_check';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE "thumbnails" ADD CONSTRAINT "${constraintName}" CHECK ("file_uuid" IS NOT NULL) NOT VALID;`,
    );

    await queryInterface.sequelize.query(
      `ALTER TABLE "thumbnails" VALIDATE CONSTRAINT "${constraintName}";`,
    );

    await queryInterface.sequelize.query(
      'ALTER TABLE "thumbnails" ALTER COLUMN "file_uuid" SET NOT NULL;',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "thumbnails" ALTER COLUMN "file_uuid" DROP NOT NULL;',
    );
  },
};
