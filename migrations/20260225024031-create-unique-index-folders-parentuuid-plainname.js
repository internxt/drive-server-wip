'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS folders_parentuuid_plainname_unique;
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX CONCURRENTLY folders_parentuuid_plainname_unique
      ON folders (parent_uuid, plain_name)
      WHERE deleted = false;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS folders_parentuuid_plainname_unique;
    `);
  },
};
