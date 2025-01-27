'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE keyserver ALTER COLUMN public_key TYPE varchar(2000);`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE keyserver ALTER COLUMN private_key TYPE varchar(3200);`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE keyserver ALTER COLUMN public_key TYPE varchar(1024);`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE keyserver ALTER COLUMN public_key TYPE varchar(2000);`,
    );
  },
};
