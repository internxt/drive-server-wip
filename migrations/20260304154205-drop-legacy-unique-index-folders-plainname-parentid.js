'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS folders_plainname_parentid_key;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX CONCURRENTLY folders_plainname_parentid_key
      ON folders (plain_name, parent_id)
      WHERE deleted = false;
    `);
  },
};
