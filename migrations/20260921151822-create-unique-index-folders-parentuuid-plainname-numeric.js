'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS folders_parentuuid_plainname_numeric_unique
      ON folders (parent_uuid, plain_name COLLATE "custom_numeric")
      WHERE deleted = false and removed = false;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS folders_parentuuid_plainname_unique;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS folders_parentuuid_plainname_unique
      ON folders (parent_uuid, plain_name)
      WHERE deleted = false and removed = false;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS folders_parentuuid_plainname_numeric_unique;
    `);
  },
};
