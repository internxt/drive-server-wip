'use strict';

const tableName = 'workspace_users';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint(tableName, {
      type: 'unique',
      fields: ['workspace_id', 'member_id'],
      name: 'workspace_users_workspaceId_memberId_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      tableName,
      'workspace_users_workspaceId_memberId_unique',
    );
  },
};
