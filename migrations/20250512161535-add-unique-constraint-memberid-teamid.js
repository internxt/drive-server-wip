'use strict';

const table_name = 'workspace_teams_users';
const constraintName = 'workspace_teams_users_member_id_team_id_key';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint(table_name, {
      fields: ['member_id', 'team_id'],
      type: 'unique',
      name: constraintName,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(table_name, constraintName);
  },
};
