'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE COLLATION IF NOT EXISTS custom_numeric (provider = icu, locale = 'en-u-kn-true');
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP COLLATION IF EXISTS custom_numeric (provider = icu, locale = 'en-u-kn-true');
    `);
  },
};
