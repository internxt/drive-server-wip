'use strict';

const tableName = 'workspaces';
const referencedTableName = 'workspace_teams';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint(tableName, {
      type: 'FOREIGN KEY',
      fields: ['default_team_id'],
      name: 'workspace_default_team_id_fkey',
      references: {
        table: referencedTableName,
        field: 'id',
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      tableName,
      'workspace_default_team_id_fkey',
    );
  },
};
