'use strict';

const table_name = 'workspace_teams_users';
const indexName = 'workspace_teams_users_member_id_team_id_index';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX CONCURRENTLY ${indexName}
      ON ${table_name} (member_id, team_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS ${indexName};
    `);
  },
};
