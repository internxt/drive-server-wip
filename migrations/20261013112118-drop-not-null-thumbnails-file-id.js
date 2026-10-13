'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`SET lock_timeout = '5s';`);
    await queryInterface.sequelize.query(
      'ALTER TABLE thumbnails ALTER COLUMN file_id DROP NOT NULL;',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE thumbnails ALTER COLUMN file_id SET NOT NULL;',
    );
  },
};
