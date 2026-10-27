'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`SET lock_timeout = '5s';`);
    await queryInterface.sequelize.query(
      'ALTER TABLE thumbnails DROP CONSTRAINT IF EXISTS thumbnails_file_id_fkey;',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`SET lock_timeout = '5s';`);
    await queryInterface.sequelize.query(
      'ALTER TABLE thumbnails ADD CONSTRAINT thumbnails_file_id_fkey FOREIGN KEY (file_id) REFERENCES files(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;',
    );
  },
};
